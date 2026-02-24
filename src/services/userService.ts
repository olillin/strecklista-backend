import {GroupId, UserId} from 'gammait'
import {Item, Price} from '../types'
import * as convert from '../util/convert'
import {database} from '../config/clients'
import {isValidComment} from "../util/helpers";
import {ItemFlags, ItemFlagsMap, parseItemFlags, TransactionFlags, TransactionFlagsMap} from "../flags";
import { prisma } from "../lib/prisma"
import type { Group, User, GroupUser } from "../../generated/prisma/client"

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

// Groups
export async function createGroup(gammaGroupId: GroupId): Promise<Group> {
    return prisma.group.create({
        data: {
            gammaId: gammaGroupId
        }
    })
}

/**
 * Create a group and user if they do not exist
 * @param gammaGroupId group id from Gamma
 * @param gammaUserId user id from Gamma
 * @return the full information of the user with `gammaUserId` in the group with `gammaGroupId`
 */
export async function addGroupUser(
    gammaGroupId: GroupId,
    gammaUserId: UserId
) {
    return prisma.groupUser.create({
        data: {
            group: {
                connectOrCreate: {
                    create: {
                        gammaId: gammaGroupId
                    },
                    where: {
                        gammaId: gammaGroupId
                    }
                }
            },
            user: {
                connectOrCreate: {
                    create: {
                        gammaId: gammaUserId
                    },
                    where: {
                        gammaId: gammaUserId
                    }
                }
            }
        }
    })
}

export async function getGroup(groupId: number): Promise<Group | null> {
    return prisma.group.findFirst({
        where: {
            id: groupId
        }
    })
}

export async function groupExists(groupId: number): Promise<boolean> {
    return getGroup(groupId).then(group => group !== null)
}

export async function gammaGroupExists(gammaGroupId: GroupId): Promise<boolean> {
    return prisma.group.findFirst({
        where: {
            gammaId: gammaGroupId
        }
    }).then(group => group !== null)
}

// Users
export async function getUser(userId: number): Promise<User | null> {
    return prisma.user.findFirst({
        where: {
            id: userId
        }
    })
}

export async function getGroupUsersFromUser(userId: number): Promise<GroupUser[] | null> {
    return prisma.groupUser.findMany({
        where: {
            userId: userId
        }
    })
}

export async function getUsersInGroup(groupId: number): Promise<GroupUser[]> {
    return prisma.groupUser.findMany({
        where: {
            groupId: groupId
        }
    })
}

// #endregion Utility

// #region Queries

export async function isUserInGroup(userId: number, groupId: number): Promise<boolean> {
    return prisma.groupUser.findFirst({
        where: {
            userId: userId,
            groupId: groupId
        }
    }).then(groupUser => groupUser !== null)
}

// Items
export interface ItemFlags {
    visible: boolean
}

export function parseFlags(flags: number): ItemFlags {
    return {
        visible: !!(flags & 0x1)
    }
}

export async function createItem(
    groupId: number,
    displayName: string,
    prices: Price[],
    iconUrl?: string
): Promise<Item> {
    return prisma.item.create({
        data: {
            groupId: groupId,
            displayName: displayName,
            prices: {
                createMany: {
                    data: prices
                }
            },
            iconUrl: iconUrl
        },
        include: {
            prices: true,
        }
    }).then(item => {
        return Object.assign(item, {
            favorite: false,
            stock: 0,
            timesPurchased: 0,
            ...parseItemFlags(item.flags)
        })
    })
}

export async function getItem(itemId: number, userId: number): Promise<Item | null> {
    const item = await prisma.item.findFirst({
        where: {
            id: itemId
        },
        include: {
            prices: true,
        }
    })

    if (item === null) {
        return null
    }

    const [isFavorite, totalPurchased, latestStockUpdate] = await Promise.all([
        hasFavorite(userId, itemId),
        prisma.purchasedItem.aggregate({
            where: {
                itemId: itemId
            },
            _sum: {
                quantity: true
            }
        }).then(aggregated => aggregated._sum.quantity ?? 0),
        prisma.itemStockUpdate.findFirst({
            where: {
                itemId: itemId
            },
            select: {
                after: true,
                stockUpdate: {
                    select: {
                        transaction: {
                            select: {
                                createdTime: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                stockUpdate: {
                    transaction: {
                        createdTime: "desc"
                    }
                }
            }
        }),
    ])

    const latestStock: number = latestStockUpdate?.after ?? 0
    const latestStockDate: Date | undefined = latestStockUpdate?.stockUpdate.transaction.createdTime
    const purchasedAfterStock: number = await prisma.purchasedItem.aggregate({
        where: {
            itemId: itemId,
            purchase: {
                transaction: {
                    createdTime: {
                        gte: latestStockDate
                    }
                }
            }
        },
        _sum: {
            quantity: true
        }
    }).then(aggregated => aggregated._sum.quantity ?? 0)
    const stock: number = latestStock - purchasedAfterStock

    return Object.assign(item, {
        favorite: isFavorite,
        stock: stock,
        timesPurchased: totalPurchased,
        ...parseItemFlags(item.flags ?? 0)
    })
}

export async function updateItem(
    itemId: number,
    userId: number,
    columns: LegalItemColumn[],
    values: unknown[],
    flags: Partial<ItemFlagsMap>,
    prices: Price[] | null
): Promise<Item> {
    prisma.item.update({
        where: {
            id: itemId
        }
    })

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
                await this.query(q.UPDATE_ITEM(columns[i]), itemId, values[i])
            }
        }
        // Set flags
        if (flags.invisible !== null) {
            await this.query(flags.invisible ? q.SET_ITEM_FLAG : q.CLEAR_ITEM_FLAG, itemId, ItemFlags.INVISIBLE)
        }
        // Set prices
        if (prices !== null) {
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

    if (itemRows === null) {
        throw new Error('Failed to get item after update')
    }

    return convert.toItem(itemRows)
}

export async function itemExistsInGroup(itemId: number, groupId: number): Promise<boolean> {
    return await this.queryFirstBoolean(
        q.ITEM_EXISTS_IN_GROUP,
        itemId,
        groupId
    )
}

export async function itemNameExistsInGroup(
    name: string,
    groupId: number
): Promise<boolean> {
    return await this.queryFirstBoolean(
        q.ITEM_NAME_EXISTS_IN_GROUP,
        name,
        groupId
    )
}

export async function isItemVisible(itemId: number): Promise<boolean> {
    return await this.queryFirstBoolean(q.IS_ITEM_VISIBLE, itemId)
}

export async function deleteItem(itemId: number): Promise<void> {
    await this.query(q.DELETE_ITEM, itemId)
}

export async function getFullItemWithPrices(
    itemId: number,
    userId: number
): Promise<tableType.FullItemWithPrices[]> {
    return await this.queryRows(q.GET_FULL_ITEM_WITH_PRICES, itemId, userId)
}

// export async function userExists(userId: number): Promise<boolean> {
//     return await this.queryFirstBoolean(q.USER_EXISTS, userId)
// }

export async function getFullItemsWithPricesInGroup(
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
export async function addPrice(
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

export async function getPricesForItem(itemId: number): Promise<tableType.Prices[]> {
    return await this.queryRows(q.GET_PRICES_FOR_ITEM, itemId)
}

export async function removePricesForItem(itemId: number): Promise<void> {
    await this.query(q.REMOVE_PRICES_FOR_ITEM, itemId)
}

// Transactions
export async function getTransaction(transactionId: number): Promise<AnyTransaction> {
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
            const purchaseRows = await this.queryRows<tableType.FullPurchases>(q.GET_FULL_PURCHASE, transactionId)
            return convert.toPurchase(purchaseRows)
        }
        case 'deposit': {
            const depositRow = (await this.queryFirstRow<tableType.Deposits>(q.GET_DEPOSIT, transactionId))!
            return convert.toDeposit(depositRow)
        }
        case 'stock_update': {
            const stockUpdateRows = await this.queryRows<tableType.FullStockUpdates>(q.GET_FULL_STOCK_UPDATE, transactionId)
            return convert.toStockUpdate(stockUpdateRows)
        }
    }
}

export async function transactionExistsInGroup(
    transactionId: number,
    groupId: number
): Promise<boolean> {
    return await this.queryFirstBoolean(
        q.TRANSACTION_EXISTS_IN_GROUP,
        transactionId,
        groupId
    )
}

export async function countTransactionsInGroup(groupId: number): Promise<number> {
    return await this.queryFirstInt(q.COUNT_TRANSACTIONS_IN_GROUP, groupId)
}

export async function getTransactionsInGroup(
    groupId: number,
    limit: number,
    offset: number
): Promise<Array<AnyTransaction>> {
    const rows = await this.queryRows<{id: number}>(
        q.GET_TRANSACTION_IDS_IN_GROUP,
        groupId,
        limit,
        offset
    )
    return await Promise.all(rows.map(({id}) => this.getTransaction(id)))
}

export async function getTransactionFlags(transactionId: number): Promise<number> {
    return await this.queryFirstInt(q.GET_TRANSACTION_FLAGS, transactionId)
}

export async function updateTransaction(transactionId: number, flags: Partial<TransactionFlagsMap>): Promise<AnyTransaction> {
    let newTransaction: AnyTransaction | null = null
    try {
        await this.query('BEGIN')

        // Set flags
        if (flags.removed !== null) {
            await this.query(flags.removed ? q.SET_TRANSACTION_FLAG : q.CLEAR_TRANSACTION_FLAG, transactionId, TransactionFlags.REMOVED)
        }
        // Get result
        newTransaction = await this.getTransaction(transactionId)

        await this.query('COMMIT')
    } catch {
        await this.query('ROLLBACK')
        throw new Error('Failed to update transaction')
    }

    if (newTransaction === null) {
        throw new Error('Failed to get transaction after update')
    }

    return newTransaction
}

// Deposit
export async function createDeposit(
    groupId: number,
    createdBy: number,
    createdFor: number,
    comment: string | null | null,
    total: number,
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
export async function createPurchase(
    groupId: number,
    createdBy: number,
    createdFor: number,
    comment: string | null | null,
    items: PurchaseItem[]
): Promise<Purchase> {
    if (!isValidComment(comment)) {
        comment = null
    }

    let purchase: Purchase | null = null
    try {
        await this.query('BEGIN')

        // Create transaction
        const dbTransaction = (await this.queryFirstRow(
            q.CREATE_PURCHASE_WITH_COMMENT,
            groupId,
            createdBy,
            createdFor,
            comment,
        ))!

        // Add items
        await Promise.all(
            items.map(async item => {
                const dbItem = getItem(item.id)
                if (!dbItem) {
                    throw new Error(
                        `Item with id ${item.id} does not exist`
                    )
                }

                console.log(`Adding item ${dbItem.id}`)
                addPurchasedItem(
                    dbTransaction.id, //
                    item.quantity,
                    item.purchasePrice,
                    dbItem.id,
                    dbItem.display_name,
                    dbItem.icon_url
                )
            })
        )
        const transaction = getTransaction(dbTransaction.id)

        if (transaction.type === 'purchase') {
            purchase = transaction as Purchase
        } else {
            throw new Error('Purchase returned wrong type after creation')
        }

    } catch (error) {
        throw error
    }

    if (!purchase) {
        throw new Error('Failed to get purchase after creation')
    }

    return purchase
}

private function addPurchasedItem(
    purchaseId: number,
    quantity: number,
    purchasePrice: Price,
    itemId: number,
    displayName: string,
    iconUrl?: string | null
): Promise<tableType.PurchasedItems> {
    if (iconUrl) {
        return (queryFirstRow(
            q.ADD_PURCHASED_ITEM_WITH_ICON, //
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
            q.ADD_PURCHASED_ITEM, //
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
export async function createStockUpdate(groupId: number, createdBy: number, comment: string | null | null, items: PostItemStockUpdate[]): Promise<StockUpdate> {
    if (!isValidComment(comment)) {
        comment = null
    }

    let stockUpdate: StockUpdate | null = null
    try {
        await this.query('BEGIN')

        // Create transaction
        const dbTransaction = (await this.queryFirstRow(
            q.CREATE_STOCK_UPDATE_WITH_COMMENT,
            groupId,
            createdBy,
            comment,
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

                console.log(`Adding stock update for item with id ${dbItem.id}`)

                const after = item.quantity + (item.absolute === true ? 0 : (dbItem as tableType.FullItem).stock)

                await this.query(
                    q.ADD_ITEM_STOCK_UPDATE, //
                    dbTransaction.id,
                    dbItem.id,
                    after,
                )
            })
        )
        const transaction = await this.getTransaction(dbTransaction.id)

        if (transaction.type === 'stockUpdate') {
            stockUpdate = transaction as StockUpdate
        } else {
            throw new Error('Stock update returned wrong type after creation')
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
export async function addFavorite(
    userId: number,
    itemId: number
): Promise<void> {
    return prisma.favoriteItem.create({
        data: {
             userId: userId,
             itemId: itemId
        }
    }).then(() => undefined)
}

export async function removeFavorite(userId: number, itemId: number): Promise<void> {
    return prisma.favoriteItem.delete({
        where: {
             userId_itemId: {
                 userId: userId,
                 itemId: itemId
             }
        }
    }).then(() => undefined)
}

export async function hasFavorite(userId: number, itemId: number): Promise<boolean> {
    return prisma.favoriteItem.findFirst({
        where: {
            userId: userId,
            itemId: itemId
        }
    }).then(favoriteItem => {
        return favoriteItem !== null
    })
}

