import {getFlag, isValidComment} from "../util/helpers"
import { prisma } from "../lib/prisma"
import { getBareItem, getItem, type Price } from "./itemService"
import type { Decimal } from "@prisma/client/runtime/client"
import type { TransactionType as PrismaTransactionType } from "../../generated/prisma/enums"
import type { PurchasedItem as PrismaPurchasedItem, ItemStockUpdate as PrismaItemStockUpdate } from "../../generated/prisma/client"
import { PurchaseItem } from "../types"
import { PurchasedItemCreateManyPurchaseInputEnvelope, PurchasedItemCreateWithoutPurchaseInput } from "../../generated/prisma/models"

export type TransactionType = 'purchase' | 'deposit' | 'stockUpdate'
export interface Transaction<T extends TransactionType> {
    type: T
    id: number

    createdBy: number
    createdTime: Date

    removed: boolean

    comment?: string
}
export type AnyTransaction = Purchase | Deposit | StockUpdate

export interface Purchase extends Transaction<'purchase'> {
    createdFor: number
    items: PurchasedItem[]
}

export interface PurchasedItem {
    item: {
        id?: number
        displayName: string
        icon?: string
    }
    quantity: number
    purchasePrice: Price
}

export interface Deposit extends Transaction<'deposit'> {
    createdFor: number
    total: Decimal
}

export interface StockUpdate extends Transaction<'stockUpdate'> {
    items: ItemStockUpdate[]
}

export interface ItemStockUpdate {
    itemId: number
    before: number
    after: number
}

export enum TransactionFlag {
    REMOVED = 0
}

export interface TransactionFlags {
    removed: boolean
}

/**
 * Get all transaction flags from a flag int
 * @param bits The bitfield data
 */
export function parseTransactionFlags(bits: number | null | undefined): TransactionFlags {
    return {
        removed: getFlag(bits, TransactionFlag.REMOVED),
    }
}

/**
 * Convert a map of transaction flags to a bitfield
 * @param flags The transaction flags
 * @return The bitfield
 */
export function serializeTransactionFlags(flags: Partial<TransactionFlags>): number {
    return Number(flags.removed) << TransactionFlag.REMOVED
}

// Transactions
interface TransactionData {
    id: number
    type: PrismaTransactionType
    createdById: number
    createdTime: Date
    flags: number | null
    comment: string | null

    purchase: {
        createdForId: number
        items: PrismaPurchasedItem[]
    } | null,

    deposit: {
        createdForId: number
        total: Decimal
    } | null,

    stockUpdate: {
        items: PrismaItemStockUpdate[]
    } | null,
}

const selectTransactionData = {
    id: true,
    type: true,
    groupId: true,
    createdById: true,
    createdTime: true,
    flags: true,
    comment: true,

    purchase: {
        include: {
            items: true
        }
    },
    deposit: true,
    stockUpdate: {
        include: {
            items: true
        }
    },
}


function parseTransaction(transaction: TransactionData): AnyTransaction {
    const flags = parseTransactionFlags(transaction.flags)
    const basicTransaction = {
        type: 'purchase',
        id: transaction.id,
        createdBy: transaction.createdById,
        createdTime: transaction.createdTime,
        removed: flags.removed,
        comment: transaction.comment ?? undefined,
    } satisfies Transaction<'purchase'>

    switch (transaction.type) {
        case 'PURCHASE': {
            return {
                ...basicTransaction,
                type: 'purchase',
                createdFor: transaction.purchase!.createdForId,
                items: transaction.purchase!.items.map<PurchasedItem>(item => ({
                    item: {
                        id: item.itemId ?? undefined,
                        displayName: item.displayName,
                        icon: item.iconUrl ?? undefined,
                    },
                    quantity: item.quantity,
                    purchasePrice: {
                        price: item.purchasePrice,
                        displayName: item.purchasePriceName,
                    }
                })),
            } satisfies Purchase
        }
        case 'DEPOSIT': {
            return {
                ...basicTransaction,
                type: 'deposit',
                createdFor: transaction.deposit!.createdForId,
                total: transaction.deposit!.total,
            } satisfies Deposit
        }
        case 'STOCK_UPDATE': {
            return {
                ...basicTransaction,
                type: 'stockUpdate',
                items: transaction.stockUpdate!.items
            } satisfies StockUpdate
        }
    }
}

export async function getTransaction(transactionId: number): Promise<AnyTransaction> {
    const transaction: TransactionData | null = await prisma.transaction.findFirst({
        where: {
            id: transactionId
        },
        select: selectTransactionData
    })

    if (!transaction) {
        throw new Error(
            `Transaction with id ${transactionId} does not exist`
        )
    }

    return parseTransaction(transaction)
}

export async function transactionExistsInGroup(
    transactionId: number,
    groupId: number
): Promise<boolean> {
    return await prisma.transaction.findFirst({
        where: {
            id: transactionId,
            groupId: groupId
        }
    }).then(transaction => transaction !== null)
}

export async function countTransactionsInGroup(groupId: number): Promise<number> {
    return await prisma.transaction.count({
        where: {
            groupId: groupId
        }
    })
}

export async function getTransactionsInGroup(
    groupId: number,
    limit: number,
    offset: number
): Promise<Array<AnyTransaction>> {
    const transactions = await prisma.transaction.findMany({
        where: {
            groupId: groupId
        },
        skip: offset,
        take: limit,
        orderBy: {
            createdTime: 'desc'
        },
        select: selectTransactionData
    })

    return transactions.map(transaction => parseTransaction(transaction))
}

export async function updateTransaction(transactionId: number, flags: Partial<TransactionFlags>): Promise<AnyTransaction> {
    const currentFlags: TransactionFlags = await prisma.transaction.findFirst({
        where: {
            id: transactionId
        },
        select: {
            flags: true
        }
    }).then(
        transaction => parseTransactionFlags(transaction?.flags ?? 0)
    )
    const newFlags: TransactionFlags = Object.assign(currentFlags, flags)
    const transaction: TransactionData = await prisma.transaction.update({
        where: {
            id: transactionId
        },
        data: {
            flags: serializeTransactionFlags(newFlags)
        },
        select: selectTransactionData
    })

    return parseTransaction(transaction)
}

// Deposit
export async function createDeposit(
    groupId: number,
    createdBy: number,
    createdFor: number,
    comment: string | null,
    total: number,
): Promise<Deposit> {
    if (!isValidComment(comment)) {
        comment = null
    }

    const transaction: TransactionData = await prisma.transaction.create({
        data: {
            type: "DEPOSIT",
            groupId: groupId,
            createdById: createdBy,
            comment: comment,
            deposit: {
                create: {
                    createdForId: createdFor,
                    total: total
                }
            }
        },
        select: selectTransactionData
    })

    return parseTransaction(transaction) as Deposit
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

    // Map items
    const purchasedItems = await Promise.all(
        items.map(async item => {
            const dbItem = await getBareItem(item.id)
            if (!dbItem) {
                throw new Error(
                    `Item with id ${item.id} does not exist`
                )
            }

            return {
                item: item.id,
                displayName: dbItem.displayName,
                iconUrl: dbItem.iconUrl,
                quantity: item.quantity,
                purchasePrice: item.purchasePrice.price,
            } satisfies PurchasedItemCreateWithoutPurchaseInput
        })
    )

    const transaction: TransactionData = await prisma.transaction.create({
        data: {
            type: "PURCHASE",
            groupId: groupId,
            createdById: createdBy,
            comment: comment,
            purchase: {
                create: {
                    createdForId: createdFor,
                    items: {
                        create: {}
                    }
                }
            }
        },
        select: selectTransactionData
    })

    return parseTransaction(transaction) as Deposit

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
