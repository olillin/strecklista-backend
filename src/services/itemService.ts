import { prisma } from '@/lib/prisma.js'
import { type Item as PrismaItem, Prisma } from '@/generated/prisma/client.js'
import type {
    ItemSelect,
    ItemUpdateInput,
} from '@/generated/prisma/models/Item.js'
import { Decimal } from '@prisma/client/runtime/client'

export interface Item {
    id: number
    createdTime: Date
    icon?: string
    displayName: string
    prices: Price[]
    stock: number
    timesPurchased: number
    visible: boolean
}

export interface ItemWithFavorite extends Item {
    favorite: boolean
}

export interface Price {
    price: Decimal
    displayName: string
}

export interface ItemFlags {
    invisible: boolean
}

export function getTopPrice(item: Item): Decimal {
    return item.prices.reduce((max, price) => {
        if (price.price.greaterThan(max)) {
            return price.price
        } else {
            return max
        }
    }, new Decimal(0))
}

// Items
export async function createItem(
    groupId: number,
    displayName: string,
    prices: Price[],
    iconUrl?: string,
    userId?: number | null
): Promise<Item | ItemWithFavorite> {
    return prisma.item
        .create({
            data: {
                groupId: groupId,
                displayName: displayName,
                prices: {
                    createMany: {
                        data: prices,
                    },
                },
                iconUrl: iconUrl ?? null,
            },
            include: {
                prices: {
                    omit: {
                        itemId: true,
                    },
                },
            },
        })
        .then(data => {
            const item: Item = {
                id: data.id,
                createdTime: data.createdTime,
                icon: data.iconUrl ?? undefined,
                displayName: data.displayName,
                prices: data.prices,
                stock: 0,
                timesPurchased: 0,
                visible: true,
            }
            if (userId == null) {
                return item
            } else {
                return Object.assign(item, {
                    favorite: false,
                }) satisfies ItemWithFavorite
            }
        })
}

interface ItemData {
    id: number
    displayName: string
    createdTime: Date
    groupId: number
    invisible: boolean
    iconUrl: string | null
    prices: Price[]

    favorites?: {
        itemId: number
    }[]

    purchasedItems: {
        quantity: number
        purchase: {
            transaction: {
                createdTime: Date
            }
        }
    }[]

    itemStockUpdates: {
        after: number
        stockUpdate: {
            transaction: {
                createdTime: Date
            }
        }
    }[]
}

function selectItemData(userId: number | undefined | null) {
    return {
        id: true,
        displayName: true,
        createdTime: true,
        groupId: true,
        invisible: true,
        iconUrl: true,
        prices: {
            omit: {
                itemId: true,
            },
        },

        favorites:
            userId == null
                ? false
                : {
                      where: {
                          userId: userId,
                      },
                      select: {
                          itemId: true,
                      },
                  },

        purchasedItems: {
            select: {
                quantity: true,
                purchase: {
                    select: {
                        transaction: {
                            select: {
                                createdTime: true,
                            },
                        },
                    },
                },
            },
        },

        itemStockUpdates: {
            orderBy: {
                stockUpdate: {
                    transaction: {
                        createdTime: 'desc',
                    },
                },
            },
            select: {
                after: true,
                stockUpdate: {
                    select: {
                        transaction: {
                            select: {
                                createdTime: true,
                            },
                        },
                    },
                },
            },
        },
    } satisfies ItemSelect
}

function parseItem(data: ItemData): Item | ItemWithFavorite {
    // Calculate stock
    const latestStockUpdate = data.itemStockUpdates[0]
    const latestStock: number = latestStockUpdate?.after ?? 0
    const latestStockDate: Date | undefined =
        latestStockUpdate?.stockUpdate.transaction.createdTime
    const purchasedAfterStock: number = data.purchasedItems
        .filter(
            p =>
                latestStockUpdate === undefined ||
                p.purchase.transaction.createdTime >= latestStockDate
        )
        .reduce((sum, p) => sum + p.quantity, 0)
    const stock: number = latestStock - purchasedAfterStock

    const totalPurchased: number = data.purchasedItems.reduce(
        (sum, p) => sum + p.quantity,
        0
    )

    // Other properties
    const item: Item = {
        id: data.id,
        createdTime: data.createdTime,
        icon: data.iconUrl ?? undefined,
        displayName: data.displayName,
        prices: data.prices,
        stock: stock,
        timesPurchased: totalPurchased,
        visible: !data.invisible,
    }

    if (data.favorites == undefined) {
        return item
    } else {
        const isFavorite = data.favorites.length !== 0
        return Object.assign(item, {
            favorite: isFavorite,
        }) satisfies ItemWithFavorite
    }
}

export async function getItem(
    itemId: number,
    userId?: number | null
): Promise<Item | ItemWithFavorite | null> {
    const data: ItemData | null = await prisma.item.findFirst({
        where: {
            id: itemId,
        },
        select: selectItemData(userId),
    })
    if (data === null) return null
    return parseItem(data)
}

export async function getItemsInGroup(
    groupId: number,
    userId?: number | null,
    visibleOnly: boolean = false
): Promise<Item[] | ItemWithFavorite[]> {
    const items: ItemData[] = await prisma.item.findMany({
        where: {
            groupId: groupId,
            invisible: visibleOnly ? false : Prisma.skip,
        },
        select: selectItemData(userId),
    })
    return items.map(data => parseItem(data))
}

export type BareItemWithPrices = PrismaItem & { prices: Price[] }

export function getBareItem(
    itemId: number
): Promise<BareItemWithPrices | null> {
    return prisma.item.findFirst({
        where: {
            id: itemId,
        },
        include: {
            prices: {
                omit: {
                    itemId: true,
                },
            },
        },
    })
}

export interface ItemPatch {
    displayName?: string
    iconUrl?: string | null
    invisible?: boolean
    prices?: Price[]
    favorite?: boolean
}

export async function updateItem(
    itemId: number,
    patch: ItemPatch,
    userId?: number | null
): Promise<Item | ItemWithFavorite> {
    const updateData: ItemUpdateInput = {}

    const queuedChanges: (() => Promise<any>)[] = []

    const updatePrices = (prices: Price[]) => {
        queuedChanges.push(() =>
            prisma.price.deleteMany({
                where: { itemId: itemId },
            })
        )
        queuedChanges.push(() =>
            prisma.item.update({
                where: {
                    id: itemId,
                },
                data: {
                    prices: {
                        createMany: {
                            data: prices,
                        },
                    },
                },
            })
        )
    }

    Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined) return
        switch (key) {
            case 'displayName':
            case 'iconUrl':
            case 'invisible':
                updateData[key] = value
                break
            case 'prices':
                updatePrices(value)
                break
            case 'favorite':
                if (userId == null) break

                if (value) {
                    queuedChanges.push(() => addFavorite(userId, itemId))
                } else {
                    queuedChanges.push(() => removeFavorite(userId, itemId))
                }
                break
            default:
                throw new Error(`Illegal key ${key}`)
        }
    })

    queuedChanges.push(() =>
        prisma.item.update({
            where: {
                id: itemId,
            },
            data: updateData,
            include: {
                prices: {
                    omit: {
                        itemId: true,
                    },
                },
            },
        })
    )

    await prisma.$transaction(async () => {
        for (const change of queuedChanges) {
            await change()
        }
    })

    const item = await getItem(itemId, userId)
    if (item === null) {
        throw new Error('Failed to get item after update')
    }
    return item
}

export async function itemExistsInGroup(
    itemId: number,
    groupId: number
): Promise<boolean> {
    return prisma.item
        .findFirst({
            where: {
                id: itemId,
                groupId: groupId,
            },
        })
        .then(item => item !== null)
}

export async function itemNameExistsInGroup(
    name: string,
    groupId: number
): Promise<boolean> {
    return prisma.item
        .findFirst({
            where: {
                displayName: name,
                groupId: groupId,
            },
        })
        .then(item => item !== null)
}

export async function isItemVisible(itemId: number): Promise<boolean> {
    const item = await getBareItem(itemId)
    if (item === null) {
        throw new Error('Item does not exist')
    }
    return !item.invisible
}

export async function deleteItem(
    itemId: number,
    groupId: number
): Promise<void> {
    return prisma.item
        .delete({
            where: {
                id: itemId,
                group: {
                    id: groupId,
                },
            },
        })
        .then(() => undefined)
}

// Prices
export async function addPrice(itemId: number, price: Price): Promise<Price> {
    return prisma.price.create({
        data: {
            itemId: itemId,
            price: price.price,
            displayName: price.displayName,
        },
    })
}

// Favorites
export async function addFavorite(
    userId: number,
    itemId: number
): Promise<void> {
    return prisma.favoriteItem
        .create({
            data: {
                userId: userId,
                itemId: itemId,
            },
        })
        .then(() => undefined)
}

export async function removeFavorite(
    userId: number,
    itemId: number
): Promise<void> {
    return prisma.favoriteItem
        .delete({
            where: {
                userId_itemId: {
                    userId: userId,
                    itemId: itemId,
                },
            },
        })
        .then(() => undefined)
}

export async function hasFavorite(
    userId: number,
    itemId: number
): Promise<boolean> {
    return prisma.favoriteItem
        .findFirst({
            where: {
                userId: userId,
                itemId: itemId,
            },
        })
        .then(favoriteItem => {
            return favoriteItem !== null
        })
}
