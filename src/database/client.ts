import { GroupId, UserId } from 'gammait'
import { EventEmitter } from 'node:events'
import pg, { Client, ClientConfig, QueryResult, QueryResultRow } from 'pg'
import { database } from '../config/clients'
import {
    ItemFlags,
    ItemFlagsMap,
    TransactionFlags,
    TransactionFlagsMap,
} from '../flags'
import {
    AnyTransaction,
    Deposit,
    Item,
    PostItemStockUpdate,
    Price,
    Purchase,
    PurchaseItem,
    StockUpdate,
} from '../types'
import * as convert from '../util/convert'
import { isValidComment } from '../util/helpers'
import * as q from './queries'
import * as tableType from './types'

// Parse numeric types
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat)

const REQUIRED_TABLES = [
    // Tables
    'groups',
    'users',
    'items',
    'prices',
    'purchases',
    'purchased_items',
    'deposits',
    'stock_updates',
    'item_stock_updates',
    'favorite_items',
    // Views
    'transactions',
    'full_purchases',
    'full_stock_updates',
    'users_total_deposited',
    'users_total_purchased',
    'user_balances',
    'full_user',
    'full_item',
]

export const legalItemColumns = [
    'id',
    'group_id',
    'display_name',
    'icon_url',
    'created_time',
    'flags',
    'favorite',
] as const
export type LegalItemColumn = (typeof legalItemColumns)[number]

class DatabaseClient extends EventEmitter {
    pg: Client

    isConnected: boolean = false
    isValidated: boolean = false
    isInvalid: boolean = false

    constructor(config?: string | ClientConfig) {
        super()
        this.pg = new Client(config)

        this.on('connected', () => {
            this.isConnected = true
        })
        this.on('validated', () => {
            this.isValidated = true
        })
        this.on('error', () => {
            this.isInvalid = true
        })

        // Connect to database
        this.pg
            .connect()
            .then(() => {
                this.emit('connected')

                console.log('Starting validation')
                // Start validation
                return this.validateDatabase()
            })
            .then(() => {
                console.log('Database validated successfully')
                return this.query("SET client_encoding = 'UTF8';")
            })
            .then(() => {
                this.emit('validated')
            })
            .catch(reason => {
                console.error('Creating database client failed: ' + reason)
            })
    }

    /**
     * Validates that the database is properly initialized and ready for use.
     * Rejects if the validation fails.
     */
    validateDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Get database tables
            this.queryRows<tableType.TableNames>(q.GET_TABLES)
                .then(tables => {
                    if (!tables) {
                        throw 'Could not get tables'
                    }
                    // Check if all required tables exist
                    const existingTables = tables.map(row => row.table_name)
                    const missingTables = REQUIRED_TABLES.filter(
                        table => !existingTables.includes(table)
                    )
                    if (missingTables.length > 0) {
                        throw `Database is missing tables: ${missingTables.join(
                            ', '
                        )}`
                    }

                    // All checks pass
                    resolve()
                })
                .catch(reason => {
                    // Validation failed
                    this.emit('error')
                    reject(
                        'Database validation failed' +
                            (reason ? `: ${reason}` : '')
                    )
                })
        })
    }

    connected: Promise<void> = new Promise((resolve, reject) => {
        const onConnected = () => {
            resolve()
        }

        const onInvalid = () => {
            reject('Failed to connect to database')
        }

        this.once('connected', onConnected)
        this.once('error', onInvalid)

        if (this.isConnected) {
            onConnected()
        } else if (this.isInvalid) {
            onInvalid()
        }
    })

    validated: Promise<typeof this> = new Promise((resolve, reject) => {
        const onValidated = () => {
            resolve(this)
        }

        const onInvalid = () => {
            reject('Database validation failed')
        }

        this.once('validated', onValidated)
        this.once('error', onInvalid)

        if (this.isValidated) {
            onValidated()
        } else if (this.isInvalid) {
            onInvalid()
        }
    })

    end() {
        return this.pg.end()
    }

    //#region Utility
    /**
     * Query a statement or transaction
     * @param query the query
     * @param args the query arguments
     * @private
     */
    private async query<T extends QueryResultRow>(
        query: string | string[],
        ...args: unknown[]
    ): Promise<QueryResult<T> | undefined> {
        if (typeof query === 'string') {
            return this.queryWithStatement(query, ...args)
        } else {
            return this.queryWithTransaction(query, ...args)
        }
    }

    /**
     * Query a statement
     * @param statement a statement
     * @param args the query arguments
     * @return the result of the statement
     * @private
     */
    private async queryWithStatement<T extends QueryResultRow>(
        statement: string,
        ...args: unknown[]
    ): Promise<QueryResult<T>> {
        try {
            await this.connected
        } catch (error) {
            throw new Error(`Failed to get database: ${error}`)
        }

        return new Promise(resolve => {
            this.pg.query(statement, args).then(response => {
                resolve(response)
            })
        })
    }

    /**
     * Query a transaction
     * @param transaction a transaction, which is a list of statements
     * @param args the query arguments
     * @throws Error if the transaction is empty
     * @throws DatabaseError if the transaction fails
     * @return the result of the last statement that returned a value, or `undefined` if no statements returned a value
     * @private
     */
    private async queryWithTransaction<T extends QueryResultRow>(
        transaction: string[],
        ...args: unknown[]
    ): Promise<QueryResult<T> | undefined> {
        if (transaction.length === 0) {
            throw new Error('Transaction must contain at least one statement')
        }

        let lastResult: QueryResult<T> | undefined = undefined
        try {
            await this.query('BEGIN')
            for (const statement of transaction) {
                const result = await this.queryWithStatement<T>(
                    statement,
                    ...args
                )
                if (result.rowCount !== null) {
                    lastResult = result
                }
            }

            await this.query('COMMIT')
            return lastResult
        } catch (error) {
            await this.query('ROLLBACK')
            throw error
        }
    }

    // async deleteTransaction(transactionId: number): Promise<void> {
    //     await this.query(q.DELETE_TRANSACTION, transactionId)
    // }

    /**
     * Get the rows returned by a query
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @return the rows returned
     * @private
     */
    private async queryRows<T extends QueryResultRow>(
        query: string | string[],
        ...args: unknown[]
    ): Promise<T[]> {
        return (await this.query<T>(query, ...args))?.rows ?? []
    }

    /**
     * Get the first row returned by a query
     * @param query a statement or transaction
     * @param args the query arguments
     * @return the first row returned, or `undefined` if no rows were returned
     * @private
     */
    private async queryFirstRow<T extends QueryResultRow>(
        query: string | string[],
        ...args: unknown[]
    ): Promise<T | undefined> {
        const rows = await this.queryRows<T>(query, ...args)
        if (rows.length === 0) return undefined
        return rows[0]
    }

    /**
     * Get the first value of the first row. Should only be used with queries which only return one column, as Postgres
     * does not care about a column order.
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @private
     */
    private async queryFirstValue(
        query: string | string[],
        ...args: unknown[]
    ): Promise<unknown> {
        const row = await this.queryFirstRow(query, ...args)
        if (!row) throw new Error('Cannot get value, query result is empty')
        const values = Object.values(row)
        if (values.length === 0)
            throw new Error('Cannot get value, query result is empty')
        return values[0]
    }

    /**
     * Get the first value of the first row as a boolean. Should only be used with queries which only return one column,
     * as Postgres does not care about column order.
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @private
     */
    private async queryFirstBoolean(
        query: string | string[],
        ...args: unknown[]
    ): Promise<boolean> {
        return !!(await this.queryFirstValue(query, ...args))
    }

    /**
     * Get the first value of the first row as a string. Should only be used with queries which only return one column,
     * as Postgres does not care about column order.
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @private
     */
    private async queryFirstString(
        query: string | string[],
        ...args: unknown[]
    ): Promise<string> {
        return String(await this.queryFirstValue(query, ...args))
    }

    /**
     * Get the first value of the first row as an integer. Should only be used with queries which only return one
     * column, as Postgres does not care about column order.
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @private
     */
    private async queryFirstInt(
        query: string | string[],
        ...args: unknown[]
    ): Promise<number> {
        return parseInt(await this.queryFirstString(query, ...args))
    }

    /**
     * Get the first value of the first row as a float. Should only be used with queries which only return one column,
     * as Postgres does not care about column order.
     * @param query a statement or transaction
     * @param args the query arguments
     * @throws Error if the query result is empty
     * @private
     */
    private async queryFirstFloat(
        query: string | string[],
        ...args: unknown[]
    ): Promise<number> {
        return parseFloat(await this.queryFirstString(query, ...args))
    }
    //#endregion Utility

    //  Groups
    async createGroup(gammaGroupId: GroupId): Promise<tableType.Groups> {
        return (await this.queryFirstRow<tableType.Groups>(
            q.CREATE_GROUP,
            gammaGroupId
        ))!
    }

    /**
     * Create a group and user if they do not exist
     * @param gammaGroupId group id from Gamma
     * @param gammaUserId user id from Gamma
     * @return the full information of the user with `gammaUserId` in the group with `gammaGroupId`
     */
    async softCreateGroupAndUser(
        gammaGroupId: GroupId,
        gammaUserId: UserId
    ): Promise<tableType.FullUser> {
        return (await this.queryWithTransaction<tableType.FullUser>(
            q.SOFT_CREATE_GROUP_AND_USER,
            gammaGroupId,
            gammaUserId
        ))!.rows[0]
    }

    async getGroup(groupId: number): Promise<tableType.Groups | undefined> {
        return await this.queryFirstRow<tableType.Groups>(q.GET_GROUP, groupId)
    }

    async groupExists(groupId: number): Promise<boolean> {
        return await this.queryFirstBoolean(q.GROUP_EXISTS, groupId)
    }

    async gammaGroupExists(gammaGroupId: GroupId): Promise<boolean> {
        return await this.queryFirstBoolean(q.GAMMA_GROUP_EXISTS, gammaGroupId)
    }

    // Users
    async createUser(
        userId: UserId,
        groupId: GroupId
    ): Promise<tableType.Users> {
        return (await this.queryFirstRow(q.CREATE_USER, userId, groupId))!
    }

    async getUser(userId: number): Promise<tableType.Users | undefined> {
        return await this.queryFirstRow(q.GET_USER, userId)
    }

    async getFullUser(userId: number): Promise<tableType.FullUser | undefined> {
        return await this.queryFirstRow<tableType.FullUser>(
            q.GET_FULL_USER,
            userId
        )
    }

    async getUsersInGroup(groupId: number): Promise<tableType.Users[]> {
        return await this.queryRows(q.GET_USERS_IN_GROUP, groupId)
    }

    async getFullUsersInGroup(groupId: number): Promise<tableType.FullUser[]> {
        return await this.queryRows(q.GET_FULL_USERS_IN_GROUP, groupId)
    }
    // #endregion Utility

    // #region Queries

    async userExistsInGroup(userId: number, groupId: number): Promise<boolean> {
        return await this.queryFirstBoolean(
            q.USER_EXISTS_IN_GROUP,
            userId,
            groupId
        )
    }

    // Items
    async createBareItem(
        groupId: number,
        displayName: string,
        iconUrl?: string
    ): Promise<tableType.Items> {
        if (iconUrl) {
            return (await this.queryFirstRow(
                q.CREATE_BARE_ITEM_WITH_ICON,
                groupId,
                displayName,
                iconUrl
            ))!
        } else {
            return (await this.queryFirstRow(
                q.CREATE_BARE_ITEM,
                groupId,
                displayName
            ))!
        }
    }

    async createItem(
        groupId: number,
        userId: number,
        displayName: string,
        prices: Price[],
        iconUrl?: string
    ): Promise<Item> {
        let dbFullItem: tableType.FullItem | undefined
        let dbPrices: tableType.Prices[]
        let favorite: boolean
        try {
            await this.query('BEGIN')

            // Create bare item
            const dbItem = await this.createBareItem(
                groupId,
                displayName,
                iconUrl
            )
            dbFullItem = await this.getFullItem(dbItem.id)
            if (!dbFullItem) {
                throw new Error('Failed to get item after creation')
            }

            // Add prices
            dbPrices = await Promise.all(
                prices.map(price =>
                    database.addPrice(dbItem.id, price.price, price.displayName)
                )
            )

            // Get favorite
            favorite = await database.isFavorite(userId, dbItem.id)

            await this.query('COMMIT')
        } catch (e) {
            await this.query('ROLLBACK')
            throw e
        }

        return convert.toItem(dbFullItem, dbPrices, favorite)
    }

    async getItem(itemId: number): Promise<tableType.Items | undefined> {
        return await this.queryFirstRow(q.GET_ITEM, itemId)
    }

    async getFullItem(itemId: number): Promise<tableType.FullItem | undefined> {
        return await this.queryFirstRow(q.GET_FULL_ITEM, itemId)
    }

    async getItemsInGroup(groupId: number): Promise<tableType.Items[]> {
        return await this.queryRows(q.GET_ITEMS_IN_GROUP, groupId)
    }

    async getItemFlags(itemId: number): Promise<number> {
        return await this.queryFirstInt(q.GET_ITEM_FLAGS, itemId)
    }

    async updateItem(
        itemId: number,
        userId: number,
        columns: LegalItemColumn[],
        values: unknown[],
        flags: Partial<ItemFlagsMap>,
        prices: Price[] | undefined
    ): Promise<Item> {
        if (columns.length !== columns.length) {
            throw new Error(
                `Mismatched array lengths, ${columns.length} columns and ${values.length} values`
            )
        }

        let itemRows: tableType.FullItemWithPrices[] | undefined = undefined
        try {
            await this.query('BEGIN')

            // Set columns
            for (let i = 0; i < columns.length; i++) {
                if (!legalItemColumns.includes(columns[i])) {
                    throw new Error(`Illegal column ${columns[i]}`)
                }
                if (columns[i] === 'favorite') {
                    // Set favorite
                    const favorite = !!values[i]
                    if (favorite) {
                        await this.addFavorite(userId, itemId)
                    } else {
                        await this.removeFavorite(userId, itemId)
                    }
                } else {
                    // Update other item columns
                    await this.query(
                        q.UPDATE_ITEM(columns[i]),
                        itemId,
                        values[i]
                    )
                }
            }
            // Set flags
            if (flags.invisible !== undefined) {
                await this.query(
                    flags.invisible ? q.SET_ITEM_FLAG : q.CLEAR_ITEM_FLAG,
                    itemId,
                    ItemFlags.INVISIBLE
                )
            }
            // Set prices
            if (prices !== undefined) {
                await this.removePricesForItem(itemId)
                for (const price of prices) {
                    await this.addPrice(itemId, price.price, price.displayName)
                }
            }
            // Get result
            itemRows = await this.getFullItemWithPrices(itemId, userId)

            await this.query('COMMIT')
        } catch {
            await this.query('ROLLBACK')
            throw new Error('Failed to update item')
        }

        if (itemRows === undefined) {
            throw new Error('Failed to get item after update')
        }

        return convert.toItem(itemRows)
    }

    async itemExistsInGroup(itemId: number, groupId: number): Promise<boolean> {
        return await this.queryFirstBoolean(
            q.ITEM_EXISTS_IN_GROUP,
            itemId,
            groupId
        )
    }

    async itemNameExistsInGroup(
        name: string,
        groupId: number
    ): Promise<boolean> {
        return await this.queryFirstBoolean(
            q.ITEM_NAME_EXISTS_IN_GROUP,
            name,
            groupId
        )
    }

    async isItemVisible(itemId: number): Promise<boolean> {
        return await this.queryFirstBoolean(q.IS_ITEM_VISIBLE, itemId)
    }

    async deleteItem(itemId: number): Promise<void> {
        await this.query(q.DELETE_ITEM, itemId)
    }

    async getFullItemWithPrices(
        itemId: number,
        userId: number
    ): Promise<tableType.FullItemWithPrices[]> {
        return await this.queryRows(q.GET_FULL_ITEM_WITH_PRICES, itemId, userId)
    }

    // async userExists(userId: number): Promise<boolean> {
    //     return await this.queryFirstBoolean(q.USER_EXISTS, userId)
    // }

    async getFullItemsWithPricesInGroup(
        groupId: number,
        userId: number
    ): Promise<tableType.FullItemWithPrices[]> {
        return await this.queryRows(
            q.GET_FULL_ITEMS_WITH_PRICES_IN_GROUP,
            groupId,
            userId
        )
    }

    // Prices
    async addPrice(
        itemId: number,
        price: number,
        displayName: string
    ): Promise<tableType.Prices> {
        return (await this.queryFirstRow(
            q.CREATE_PRICE,
            itemId,
            price,
            displayName
        ))!
    }

    async getPricesForItem(itemId: number): Promise<tableType.Prices[]> {
        return await this.queryRows(q.GET_PRICES_FOR_ITEM, itemId)
    }

    async removePricesForItem(itemId: number): Promise<void> {
        await this.query(q.REMOVE_PRICES_FOR_ITEM, itemId)
    }

    // Transactions
    async getTransaction(transactionId: number): Promise<AnyTransaction> {
        const transaction = await this.queryFirstRow<tableType.Transactions>(
            q.GET_TRANSACTION,
            transactionId
        )
        if (!transaction) {
            throw new Error(
                `Transaction with id ${transactionId} does not exist`
            )
        }
        switch (transaction.type) {
            case 'purchase': {
                const purchaseRows =
                    await this.queryRows<tableType.FullPurchases>(
                        q.GET_FULL_PURCHASE,
                        transactionId
                    )
                return convert.toPurchase(purchaseRows)
            }
            case 'deposit': {
                const depositRow =
                    (await this.queryFirstRow<tableType.Deposits>(
                        q.GET_DEPOSIT,
                        transactionId
                    ))!
                return convert.toDeposit(depositRow)
            }
            case 'stock_update': {
                const stockUpdateRows =
                    await this.queryRows<tableType.FullStockUpdates>(
                        q.GET_FULL_STOCK_UPDATE,
                        transactionId
                    )
                return convert.toStockUpdate(stockUpdateRows)
            }
        }
    }

    async transactionExistsInGroup(
        transactionId: number,
        groupId: number
    ): Promise<boolean> {
        return await this.queryFirstBoolean(
            q.TRANSACTION_EXISTS_IN_GROUP,
            transactionId,
            groupId
        )
    }

    async countTransactionsInGroup(groupId: number): Promise<number> {
        return await this.queryFirstInt(q.COUNT_TRANSACTIONS_IN_GROUP, groupId)
    }

    async getTransactionsInGroup(
        groupId: number,
        limit: number,
        offset: number
    ): Promise<Array<AnyTransaction>> {
        const rows = await this.queryRows<{ id: number }>(
            q.GET_TRANSACTION_IDS_IN_GROUP,
            groupId,
            limit,
            offset
        )
        return await Promise.all(rows.map(({ id }) => this.getTransaction(id)))
    }

    async getTransactionFlags(transactionId: number): Promise<number> {
        return await this.queryFirstInt(q.GET_TRANSACTION_FLAGS, transactionId)
    }

    async updateTransaction(
        transactionId: number,
        flags: Partial<TransactionFlagsMap>
    ): Promise<AnyTransaction> {
        let newTransaction: AnyTransaction | undefined = undefined
        try {
            await this.query('BEGIN')

            // Set flags
            if (flags.removed !== undefined) {
                await this.query(
                    flags.removed
                        ? q.SET_TRANSACTION_FLAG
                        : q.CLEAR_TRANSACTION_FLAG,
                    transactionId,
                    TransactionFlags.REMOVED
                )
            }
            // Get result
            newTransaction = await this.getTransaction(transactionId)

            await this.query('COMMIT')
        } catch {
            await this.query('ROLLBACK')
            throw new Error('Failed to update transaction')
        }

        if (newTransaction === undefined) {
            throw new Error('Failed to get transaction after update')
        }

        return newTransaction
    }

    // Deposit
    async createDeposit(
        groupId: number,
        createdBy: number,
        createdFor: number,
        comment: string | undefined | null,
        total: number
    ): Promise<Deposit> {
        if (!isValidComment(comment)) {
            comment = null
        }
        const row = (await this.queryFirstRow<tableType.Deposits>(
            q.CREATE_DEPOSIT_WITH_COMMENT,
            groupId,
            createdBy,
            createdFor,
            comment,
            total
        ))!
        return convert.toDeposit(row)
    }

    // Purchases
    async createPurchase(
        groupId: number,
        createdBy: number,
        createdFor: number,
        comment: string | undefined | null,
        items: PurchaseItem[]
    ): Promise<Purchase> {
        if (!isValidComment(comment)) {
            comment = null
        }

        let purchase: Purchase | undefined = undefined
        try {
            await this.query('BEGIN')

            // Create transaction
            const dbTransaction = (await this.queryFirstRow(
                q.CREATE_PURCHASE_WITH_COMMENT,
                groupId,
                createdBy,
                createdFor,
                comment
            ))!

            // Add items
            await Promise.all(
                items.map(async item => {
                    const dbItem = await this.getItem(item.id)
                    if (!dbItem) {
                        throw new Error(
                            `Item with id ${item.id} does not exist`
                        )
                    }

                    console.log(`Adding item ${dbItem.id}`)
                    await this.addPurchasedItem(
                        dbTransaction.id,
                        item.quantity,
                        item.purchasePrice,
                        dbItem.id,
                        dbItem.display_name,
                        dbItem.icon_url
                    )
                })
            )
            const transaction = await this.getTransaction(dbTransaction.id)

            if (transaction.type === 'purchase') {
                purchase = transaction as Purchase
            } else {
                throw new Error('Purchase returned wrong type after creation')
            }

            await this.query('COMMIT')
        } catch (error) {
            await this.query('ROLLBACK')
            throw error
        }

        if (!purchase) {
            throw new Error('Failed to get purchase after creation')
        }

        return purchase
    }

    private async addPurchasedItem(
        purchaseId: number,
        quantity: number,
        purchasePrice: Price,
        itemId: number,
        displayName: string,
        iconUrl?: string | null
    ): Promise<tableType.PurchasedItems> {
        if (iconUrl) {
            return (await this.queryFirstRow(
                q.ADD_PURCHASED_ITEM_WITH_ICON,
                purchaseId,
                quantity,
                purchasePrice.price,
                purchasePrice.displayName,
                itemId,
                displayName,
                iconUrl
            ))!
        } else {
            return (await this.queryFirstRow(
                q.ADD_PURCHASED_ITEM,
                purchaseId,
                quantity,
                purchasePrice.price,
                purchasePrice.displayName,
                itemId,
                displayName
            ))!
        }
    }

    // Stock updates
    async createStockUpdate(
        groupId: number,
        createdBy: number,
        comment: string | undefined | null,
        items: PostItemStockUpdate[]
    ): Promise<StockUpdate> {
        if (!isValidComment(comment)) {
            comment = null
        }

        let stockUpdate: StockUpdate | undefined = undefined
        try {
            await this.query('BEGIN')

            // Create transaction
            const dbTransaction = (await this.queryFirstRow(
                q.CREATE_STOCK_UPDATE_WITH_COMMENT,
                groupId,
                createdBy,
                comment
            ))!

            // Add item stock updates
            await Promise.all(
                items.map(async item => {
                    let dbItem
                    if (item.absolute === true) {
                        dbItem = await this.getItem(item.id)
                    } else {
                        dbItem = await this.getFullItem(item.id)
                    }
                    if (!dbItem) {
                        throw new Error(
                            `Item with id ${item.id} does not exist`
                        )
                    }

                    console.log(
                        `Adding stock update for item with id ${dbItem.id}`
                    )

                    const after =
                        item.quantity +
                        (item.absolute === true
                            ? 0
                            : (dbItem as tableType.FullItem).stock)

                    await this.query(
                        q.ADD_ITEM_STOCK_UPDATE,
                        dbTransaction.id,
                        dbItem.id,
                        after
                    )
                })
            )
            const transaction = await this.getTransaction(dbTransaction.id)

            if (transaction.type === 'stockUpdate') {
                stockUpdate = transaction as StockUpdate
            } else {
                throw new Error(
                    'Stock update returned wrong type after creation'
                )
            }

            await this.query('COMMIT')
        } catch (error) {
            await this.query('ROLLBACK')
            throw error
        }

        if (!stockUpdate) {
            throw new Error('Failed to get stock update after creation')
        }

        return stockUpdate
    }

    // Favorites
    async addFavorite(
        userId: number,
        itemId: number
    ): Promise<tableType.FavoriteItems> {
        return (await this.queryWithTransaction<tableType.FavoriteItems>(
            q.ADD_FAVORITE_ITEM,
            userId,
            itemId
        ))!.rows[0]
    }

    async removeFavorite(userId: number, itemId: number): Promise<void> {
        await this.query(q.REMOVE_FAVORITE_ITEM, userId, itemId)
    }

    async isFavorite(userId: number, itemId: number): Promise<boolean> {
        return await this.queryFirstBoolean(
            q.FAVORITE_ITEM_EXISTS,
            userId,
            itemId
        )
    }
}

export default DatabaseClient
