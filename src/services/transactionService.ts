import { isValidComment } from '../util/helpers'
import { prisma } from '../lib/prisma'
import { getBareItem, getItem, type Price } from './itemService'
import { Decimal } from '@prisma/client/runtime/client'
import type { TransactionType as PrismaTransactionType } from '../generated/prisma/enums'
import {
    type PurchasedItem as PrismaPurchasedItem,
    type ItemStockUpdate as PrismaItemStockUpdate,
    Prisma,
} from '../generated/prisma/client'
import { PurchaseItem } from '../routes/api/postPurchase'
import {
    ItemStockUpdateCreateManyStockUpdateInput,
    PurchasedItemUncheckedCreateWithoutPurchaseInput,
    TransactionSelect,
    TransactionUpdateInput,
} from '../generated/prisma/models'
import { PostItemStockUpdate } from '../routes/api/postStockUpdate'

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

export interface TransactionPatch {
    removed?: boolean
}

// Transactions
interface TransactionData {
    id: number
    type: PrismaTransactionType
    createdById: number
    createdTime: Date
    removed: boolean
    comment: string | null

    purchase: {
        createdForId: number
        items: PrismaPurchasedItem[]
    } | null

    deposit: {
        createdForId: number
        total: Decimal
    } | null

    stockUpdate: {
        items: PrismaItemStockUpdate[]
    } | null
}

const selectTransactionData = {
    id: true,
    type: true,
    groupId: true,
    createdById: true,
    createdTime: true,
    removed: true,
    comment: true,

    purchase: {
        include: {
            items: true,
        },
    },
    deposit: true,
    stockUpdate: {
        include: {
            items: true,
        },
    },
} satisfies TransactionSelect

function parseTransaction(transaction: TransactionData): AnyTransaction {
    const basicTransaction: Transaction<'purchase'> = {
        type: 'purchase',
        id: transaction.id,
        createdBy: transaction.createdById,
        createdTime: transaction.createdTime,
        removed: transaction.removed,
        comment: transaction.comment ?? undefined,
    }

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
                    },
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
                items: transaction.stockUpdate!.items,
            } satisfies StockUpdate
        }
    }
}

export async function getTransaction(
    transactionId: number
): Promise<AnyTransaction> {
    const transaction: TransactionData | null =
        await prisma.transaction.findFirst({
            where: {
                id: transactionId,
            },
            select: selectTransactionData,
        })

    if (!transaction) {
        throw new Error(`Transaction with id ${transactionId} does not exist`)
    }
    return parseTransaction(transaction)
}

export async function transactionExistsInGroup(
    transactionId: number,
    groupId: number
): Promise<boolean> {
    return await prisma.transaction
        .findFirst({
            where: {
                id: transactionId,
                groupId: groupId,
            },
        })
        .then(transaction => transaction !== null)
}

export async function countTransactionsInGroup(
    groupId: number
): Promise<number> {
    return await prisma.transaction.count({
        where: {
            groupId: groupId,
        },
    })
}

export interface GetTransactionsOptions {
    createdBy?: number
    createdFor?: number
}

export async function getTransactionsInGroup(
    groupId: number,
    limit: number,
    offset: number,
    options: GetTransactionsOptions = {}
): Promise<Array<AnyTransaction>> {
    const transactions = await prisma.transaction.findMany({
        where: {
            groupId: groupId,
            createdById: options.createdBy ?? Prisma.skip,
            ...(options.createdFor == undefined
                ? {}
                : {
                      OR: [
                          {
                              purchase: {
                                  createdForId: options.createdFor,
                              },
                          },
                          {
                              deposit: {
                                  createdForId: options.createdFor,
                              },
                          },
                      ],
                  }),
        },
        skip: offset,
        take: limit,
        orderBy: {
            createdTime: 'desc',
        },
        select: selectTransactionData,
    })
    return transactions.map(transaction => parseTransaction(transaction))
}

export async function updateTransaction(
    transactionId: number,
    patch: TransactionPatch
): Promise<AnyTransaction> {
    const data =
        patch.removed == undefined
            ? {}
            : ({
                  removed: patch.removed,
              } satisfies TransactionUpdateInput)

    const transaction: TransactionData = await prisma.transaction.update({
        where: {
            id: transactionId,
        },
        data,
        select: selectTransactionData,
    })

    return parseTransaction(transaction)
}

// Deposit
export async function createDeposit(
    groupId: number,
    createdBy: number,
    createdFor: number,
    comment: string | null,
    total: number
): Promise<Deposit> {
    if (!isValidComment(comment)) {
        comment = null
    }

    const transaction: TransactionData = await prisma.transaction.create({
        data: {
            type: 'DEPOSIT',
            groupId: groupId,
            createdById: createdBy,
            comment: comment,
            deposit: {
                create: {
                    createdForId: createdFor,
                    total: total,
                },
            },
        },
        select: selectTransactionData,
    })

    return parseTransaction(transaction) as Deposit
}

// Purchases
export async function createPurchase(
    groupId: number,
    createdBy: number,
    createdFor: number,
    comment: string | null,
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
                throw new Error(`Item with id ${item.id} does not exist`)
            }

            return {
                itemId: item.id,
                displayName: dbItem.displayName,
                iconUrl: dbItem.iconUrl,
                quantity: item.quantity,
                purchasePrice: new Decimal(item.purchasePrice.price),
                purchasePriceName: item.purchasePrice.displayName,
            } satisfies PurchasedItemUncheckedCreateWithoutPurchaseInput
        })
    )

    const transaction: TransactionData = await prisma.transaction.create({
        data: {
            type: 'PURCHASE',
            groupId: groupId,
            createdById: createdBy,
            comment: comment,
            purchase: {
                create: {
                    createdForId: createdFor,
                    items: {
                        createMany: {
                            data: purchasedItems,
                        },
                    },
                },
            },
        },
        select: selectTransactionData,
    })

    return parseTransaction(transaction) as Purchase
}

// Stock updates
export async function createStockUpdate(
    groupId: number,
    createdBy: number,
    comment: string | null | null,
    items: PostItemStockUpdate[]
): Promise<StockUpdate> {
    if (!isValidComment(comment)) {
        comment = null
    }

    // Map items
    const stockedItems = await Promise.all(
        items.map(async item => {
            const currentStock = await getItem(item.id, 0).then(
                dbItem => dbItem?.stock
            )
            if (currentStock === undefined) {
                throw new Error(`Item with id ${item.id} does not exist`)
            }

            const newStock = item.absolute
                ? item.quantity
                : currentStock + item.quantity

            return {
                itemId: item.id,
                before: currentStock,
                after: newStock,
            } satisfies ItemStockUpdateCreateManyStockUpdateInput
        })
    )

    const transaction: TransactionData = await prisma.transaction.create({
        data: {
            type: 'STOCK_UPDATE',
            groupId: groupId,
            createdById: createdBy,
            comment: comment,
            stockUpdate: {
                create: {
                    items: {
                        createMany: {
                            data: stockedItems,
                        },
                    },
                },
            },
        },
        select: selectTransactionData,
    })

    return parseTransaction(transaction) as StockUpdate
}
