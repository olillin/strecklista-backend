import { prisma } from '../lib/prisma'
import type { Item as PrismaItem } from '../generated/prisma/client'
import { ItemSelect, ItemUpdateInput } from '../generated/prisma/models'
import { Decimal } from '@prisma/client/runtime/client'
import { getFlag } from '../util/helpers'

export interface Item {
    id: number
    createdTime: Date
    icon?: string
    displayName: string
    prices: Price[]
    stock: number
    timesPurchased: number
    visible: boolean
    favorite: boolean
}

export interface Price {
    price: Decimal
    displayName: string
}

export enum ItemFlag {
    INVISIBLE = 0,
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

/**
 * Parse item flags from a bitfield
 * @param bits The bitfield data
 */
export function parseItemFlags(bits: number | null | undefined): ItemFlags {
    return {
        invisible: getFlag(bits, ItemFlag.INVISIBLE),
    }
}

/**
 * Convert a map of item flags to a bitfield
 * @param flags The item flags
 * @return The bitfield
 */
export function serializeItemFlags(flags: Partial<ItemFlags>): number {
    return Number(flags.invisible) << ItemFlag.INVISIBLE
}

// Items
export async function createItem(
    groupId: number,
    displayName: string,
    prices: Price[],
    iconUrl?: string
): Promise<Item> {
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
                iconUrl: iconUrl,
            },
            include: {
                prices: {
                    omit: {
                        itemId: true,
                    },
                },
            },
        })
        .then(item => {
            return {
                id: item.id,
                createdTime: item.createdTime,
                icon: item.iconUrl ?? undefined,
                displayName: item.displayName,
                prices: item.prices,
                stock: 0,
                timesPurchased: 0,
                visible: true,
                favorite: false,
            } satisfies Item
        })
}

interface ItemData {
    id: number
    displayName: string
    createdTime: Date
    groupId: number
    flags: number | null
    iconUrl: string | null
    prices: Price[]

    favorites: {
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

function selectItemData(userId: number) {
    return {
        id: true,
        displayName: true,
        createdTime: true,
        groupId: true,
        flags: true,
        iconUrl: true,
        prices: {
            omit: {
                itemId: true,
            },
        },

        favorites: {
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

function parseItem(item: ItemData): Item {
    // Calculate stock
    const latestStockUpdate = item.itemStockUpdates[0]
    const latestStock: number = latestStockUpdate?.after ?? 0
    const latestStockDate: Date | undefined =
        latestStockUpdate?.stockUpdate.transaction.createdTime
    const purchasedAfterStock: number = item.purchasedItems
        .filter(
            p =>
                latestStockUpdate === undefined ||
                p.purchase.transaction.createdTime >= latestStockDate
        )
        .reduce((sum, p) => sum + p.quantity, 0)
    const stock: number = latestStock - purchasedAfterStock

    const totalPurchased: number = item.purchasedItems.reduce(
        (sum, p) => sum + p.quantity,
        0
    )

    // Get other properties
    const flags = parseItemFlags(item.flags ?? 0)
    const isFavorite = item.favorites.length !== 0

    return {
        id: item.id,
        createdTime: item.createdTime,
        icon: item.iconUrl ?? undefined,
        displayName: item.displayName,
        prices: item.prices,
        stock: stock,
        timesPurchased: totalPurchased,
        visible: !flags.invisible,
        favorite: isFavorite,
    }
}

export async function getItem(
    itemId: number,
    userId: number
): Promise<Item | null> {
    const item: ItemData | null = await prisma.item.findFirst({
        where: {
            id: itemId,
        },
        select: selectItemData(userId),
    })
    if (item === null) return null
    return parseItem(item)
}

export async function getItemsInGroup(
    groupId: number,
    userId: number
): Promise<Item[]> {
    const items: ItemData[] = await prisma.item.findMany({
        where: {
            groupId: groupId,
        },
        select: selectItemData(userId),
    })
    return items.map(item => parseItem(item))
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
    iconUrl?: string
    flags?: Partial<ItemFlags>
    prices?: Price[]
    favorite?: boolean
}

export async function updateItem(
    itemId: number,
    userId: number,
    data: ItemPatch
): Promise<Item> {
    const updateData: ItemUpdateInput = {}

    const queuedChanges: (() => Promise<any>)[] = []

    const updateFlags = async (flags: Partial<ItemFlags>) => {
        const currentFlags: ItemFlags = await getBareItem(itemId).then(item =>
            parseItemFlags(item?.flags ?? 0)
        )
        const newFlags: ItemFlags = Object.assign(currentFlags, flags)
        updateData.flags = serializeItemFlags(newFlags)
    }

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

    Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        switch (key) {
            case 'displayName':
            case 'iconUrl':
                updateData[key] = value
                break
            case 'flags':
                updateFlags(value)
                break
            case 'prices':
                updatePrices(value)
                break
            case 'favorite':
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
    return ((item.flags ?? 0) & ItemFlag.INVISIBLE) === 0
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
