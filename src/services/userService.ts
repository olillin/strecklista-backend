import { GroupId, UserId } from 'gammait'
import { prisma } from '../lib/prisma'
import {
    Decimal,
    PrismaClientKnownRequestError,
} from '@prisma/client/runtime/client'
import { UserSelect } from '../generated/prisma/models'
import { PrismaClient } from '@prisma/client/extension'

export interface OfflineGroup {
    id: number
    gammaId: GroupId
}

export interface OfflineUser {
    id: number
    gammaId: UserId
}

export interface OfflineGroupUser {
    user: OfflineUser
    group: OfflineGroup
    balance: Decimal
}

// Groups
export async function createGroup(
    gammaGroupId: GroupId
): Promise<OfflineGroup> {
    return prisma.group
        .create({
            data: {
                gammaId: gammaGroupId,
            },
        })
        .then(
            group =>
                ({
                    id: group.id,
                    gammaId: group.gammaId as GroupId,
                }) satisfies OfflineGroup
        )
}

/**
 * Create a group and user if they do not exist
 * @param gammaGroupId group id from Gamma
 * @param gammaUserId user id from Gamma
 * @param maxRetries Max amount of times to retry on fail caused by contention.
 * @return the full information of the user with `gammaUserId` in the group with `gammaGroupId`
 */
export async function softAddGroupUser(
    gammaGroupId: GroupId,
    gammaUserId: UserId,
    maxRetries: number = 5
): Promise<OfflineGroupUser> {
    const createGroupUser = async (
        gammaGroupId: GroupId,
        gammaUserId: UserId,
        tx: PrismaClient
    ): Promise<OfflineGroupUser> => {
        const groupUser = await tx.groupUser.create({
            data: {
                group: {
                    connectOrCreate: {
                        create: {
                            gammaId: gammaGroupId,
                        },
                        where: {
                            gammaId: gammaGroupId,
                        },
                    },
                },
                user: {
                    connectOrCreate: {
                        create: {
                            gammaId: gammaUserId,
                        },
                        where: {
                            gammaId: gammaUserId,
                        },
                    },
                },
            },
            include: {
                group: {
                    select: {
                        gammaId: true,
                    },
                },
            },
        })

        const groupUserData = (await _getGroupUserData(
            groupUser.userId,
            groupUser.groupId,
            tx
        ))!
        const balance = calculateBalance(groupUserData)
        return {
            user: {
                id: groupUserData.id,
                gammaId: groupUserData.gammaId,
            },
            group: {
                id: groupUser.groupId,
                gammaId: groupUser.group.gammaId as GroupId,
            },
            balance: balance,
        }
    }

    return prisma.$transaction<OfflineGroupUser>(async tx => {
        for (let i = 0; i <= maxRetries; i++) {
            try {
                const groupUser = await tx.groupUser.findFirst({
                    where: {
                        user: {
                            gammaId: gammaUserId,
                        },
                        group: {
                            gammaId: gammaGroupId,
                        },
                    },
                })
                if (groupUser != null) {
                    const offlineGroupUser = await _getUserInGroup(
                        groupUser.userId,
                        groupUser.groupId,
                        tx
                    )
                    if (offlineGroupUser == null) {
                        throw new Error('Group user is suddenly null')
                    }
                    return offlineGroupUser
                }
                return createGroupUser(gammaGroupId, gammaUserId, tx)
            } catch (error) {
                if (error instanceof PrismaClientKnownRequestError) {
                    continue
                }
                throw error
            }
        }
        throw new Error('Failed to create user')
    })
}

async function _getUserInGroup(
    userId: number,
    groupId: number,
    tx: PrismaClient
): Promise<OfflineGroupUser | null> {
    const groupUser = await tx.groupUser.findFirst({
        where: {
            userId: userId,
            groupId: groupId,
        },
        include: {
            user: {
                select: selectUserData(groupId),
            },
            group: true,
        },
    })
    if (groupUser === null) return null
    const balance = calculateBalance(groupUser)
    return {
        user: {
            id: groupUser.user.id,
            gammaId: groupUser.user.gammaId as UserId,
        },
        group: {
            id: groupUser.groupId,
            gammaId: groupUser.group.gammaId as GroupId,
        },
        balance: balance,
    }
}

export async function getOfflineGroupUser(
    userId: number,
    groupId: number
): Promise<OfflineGroupUser | null> {
    return _getUserInGroup(userId, groupId, prisma)
}

export async function getOfflineGroup(
    groupId: number
): Promise<OfflineGroup | null> {
    return prisma.group
        .findFirst({
            where: {
                id: groupId,
            },
        })
        .then(group => {
            if (group === null) return null

            return {
                id: group.id,
                gammaId: group.gammaId as GroupId,
            } satisfies OfflineGroup
        })
}

export async function groupExists(groupId: number): Promise<boolean> {
    return getOfflineGroup(groupId).then(group => group !== null)
}

export async function isGammaGroupRegistered(
    gammaGroupId: GroupId
): Promise<boolean> {
    return prisma.group
        .findFirst({
            where: {
                gammaId: gammaGroupId,
            },
        })
        .then(group => group !== null)
}

// Users
interface GroupUserData {
    id: number
    gammaId: UserId
    receivedDeposits: {
        total: Decimal
    }[]
    receivedPurchases: {
        items: {
            purchasePrice: Decimal
            quantity: number
        }[]
    }[]
}

function selectUserData(groupId: number) {
    return {
        id: true,
        gammaId: true,
        receivedDeposits: {
            where: {
                transaction: {
                    groupId: groupId,
                    removed: false,
                },
            },
            select: {
                total: true,
            },
        },
        receivedPurchases: {
            where: {
                transaction: {
                    groupId: groupId,
                    removed: false,
                },
            },
            select: {
                items: {
                    select: {
                        purchasePrice: true,
                        quantity: true,
                    },
                },
            },
        },
    } satisfies UserSelect
}

function calculateBalance(userData: GroupUserData): Decimal {
    const totalDeposited: Decimal = userData.receivedDeposits.reduce(
        (sum, deposit) => sum.add(deposit.total),
        new Decimal(0)
    )
    const totalPurchased: Decimal = userData.receivedPurchases.reduce(
        (sum, purchase) =>
            sum.add(
                purchase.items.reduce(
                    (purchaseSum, item) =>
                        purchaseSum.add(item.purchasePrice.mul(item.quantity)),
                    new Decimal(0)
                )
            ),
        new Decimal(0)
    )
    const balance: Decimal = totalDeposited.sub(totalPurchased)
    return balance
}

async function _getGroupUserData(
    userId: number,
    groupId: number,
    tx: PrismaClient
): Promise<GroupUserData | null> {
    const data: GroupUserData | null = await tx.user.findFirst({
        where: {
            id: userId,
        },
        select: selectUserData(groupId),
    })
    return data
}

export async function getOfflineUser(
    userId: number
): Promise<OfflineUser | null> {
    return await prisma.user
        .findFirst({
            where: {
                id: userId,
            },
        })
        .then(user => {
            if (user == null) return null

            return {
                id: user.id,
                gammaId: user.gammaId as UserId,
            }
        })
}

export async function getOfflineUserGroups(
    userId: number
): Promise<OfflineGroup[] | null> {
    return prisma.groupUser
        .findMany({
            where: {
                userId: userId,
            },
            select: {
                group: true,
            },
        })
        .then(groupUsers =>
            groupUsers.map(
                groupUser =>
                    ({
                        id: groupUser.group.id,
                        gammaId: groupUser.group.gammaId as GroupId,
                    }) satisfies OfflineGroup
            )
        )
}

export async function getOfflineUsersInGroup(
    groupId: number
): Promise<OfflineGroupUser[]> {
    const groupUsers = await prisma.groupUser.findMany({
        where: {
            groupId: groupId,
        },
        select: {
            user: {
                select: selectUserData(groupId),
            },
            group: true,
        },
    })

    return groupUsers.map(groupUser => {
        const groupUserData: GroupUserData = {
            id: groupUser.user.id,
            gammaId: groupUser.user.gammaId as UserId,
            receivedDeposits: groupUser.user.receivedDeposits,
            receivedPurchases: groupUser.user.receivedPurchases,
        }
        const balance = calculateBalance(groupUserData)
        return {
            user: {
                id: groupUser.user.id,
                gammaId: groupUser.user.gammaId as UserId,
            },
            group: {
                id: groupUser.group.id,
                gammaId: groupUser.group.gammaId as GroupId,
            },
            balance,
        } satisfies OfflineGroupUser
    })
}

export async function isUserInGroup(
    userId: number,
    groupId: number
): Promise<boolean> {
    return prisma.groupUser
        .findFirst({
            where: {
                userId: userId,
                groupId: groupId,
            },
        })
        .then(groupUser => groupUser !== null)
}
