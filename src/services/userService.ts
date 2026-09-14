import * as gamma from 'gammait'
import { prisma } from '@/lib/prisma.js'
import {
    Decimal,
    PrismaClientKnownRequestError,
} from '@prisma/client/runtime/client'
import type { UserSelect } from '@/generated/prisma/models/User.js'
import { Prisma } from '@/generated/prisma/client.js'
import type { GroupUserUpdateInput } from '@/generated/prisma/models.js'
export type PrismaTransactionalClient = Prisma.TransactionClient

export interface OfflineGroup {
    id: number
    gammaId: gamma.GroupId
}

export interface OfflineUser {
    id: number
    gammaId: gamma.UserId
}

export interface OfflineGroupUser {
    user: OfflineUser
    group: OfflineGroup
    balance: Decimal
    externalId?: string
}

// Groups
export async function createGroup(
    gammaGroupId: gamma.GroupId
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
                    gammaId: group.gammaId as gamma.GroupId,
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
    gammaGroupId: gamma.GroupId,
    gammaUserId: gamma.UserId,
    maxRetries: number = 5
): Promise<OfflineGroupUser> {
    const createGroupUser = async (
        gammaGroupId: gamma.GroupId,
        gammaUserId: gamma.UserId,
        tx: PrismaTransactionalClient
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
                gammaId: groupUser.group.gammaId as gamma.GroupId,
            },
            balance: balance,
            externalId: groupUser.externalId ?? undefined,
        }
    }

    return await prisma.$transaction<OfflineGroupUser>(async tx => {
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

interface GroupAndUserData {
    user: GroupUserData
    group: OfflineGroup
    externalId: string | null
}

async function _getUserInGroup(
    userId: number,
    groupId: number,
    tx: PrismaTransactionalClient
): Promise<OfflineGroupUser | null> {
    const groupUser: GroupAndUserData | null = await tx.groupUser
        .findFirst({
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
        .then(groupUser => {
            if (groupUser == null) return null

            return {
                user: {
                    id: groupUser.user.id,
                    gammaId: groupUser.user.gammaId as gamma.UserId,
                    receivedDeposits: groupUser.user.receivedDeposits,
                    receivedPurchases: groupUser.user.receivedPurchases,
                },
                group: {
                    id: groupUser.group.id,
                    gammaId: groupUser.group.gammaId as gamma.GroupId,
                },
                externalId: groupUser.externalId,
            } satisfies GroupAndUserData
        })
    if (groupUser === null) return null
    const balance = calculateBalance(groupUser.user)
    return {
        user: {
            id: groupUser.user.id,
            gammaId: groupUser.user.gammaId as gamma.UserId,
        },
        group: groupUser.group,
        balance: balance,
        externalId: groupUser.externalId ?? undefined,
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
                gammaId: group.gammaId as gamma.GroupId,
            } satisfies OfflineGroup
        })
}

export async function groupExists(groupId: number): Promise<boolean> {
    return getOfflineGroup(groupId).then(group => group !== null)
}

export async function isGammaGroupRegistered(
    gammaGroupId: gamma.GroupId
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
    gammaId: gamma.UserId
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
    tx: PrismaTransactionalClient
): Promise<GroupUserData | null> {
    const data: GroupUserData | null = await tx.user
        .findFirst({
            where: {
                id: userId,
            },
            select: selectUserData(groupId),
        })
        .then(user => {
            if (user == null) return null

            return {
                id: user.id,
                gammaId: user.gammaId as gamma.GroupId,
                receivedDeposits: user.receivedDeposits,
                receivedPurchases: user.receivedPurchases,
            } satisfies GroupUserData
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
                gammaId: user.gammaId as gamma.UserId,
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
                        gammaId: groupUser.group.gammaId as gamma.GroupId,
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
            externalId: true,
        },
    })

    return groupUsers.map(groupUser => {
        const groupUserData: GroupUserData = {
            id: groupUser.user.id,
            gammaId: groupUser.user.gammaId as gamma.UserId,
            receivedDeposits: groupUser.user.receivedDeposits,
            receivedPurchases: groupUser.user.receivedPurchases,
        }
        const balance = calculateBalance(groupUserData)
        return {
            user: {
                id: groupUser.user.id,
                gammaId: groupUser.user.gammaId as gamma.UserId,
            },
            group: {
                id: groupUser.group.id,
                gammaId: groupUser.group.gammaId as gamma.GroupId,
            },
            balance: balance,
            externalId: groupUser.externalId ?? undefined,
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

export async function isExternalUserInGroup(
    externalUserId: string,
    groupId: number
): Promise<boolean> {
    return prisma.groupUser
        .findFirst({
            where: {
                externalId: externalUserId,
                groupId: groupId,
            },
        })
        .then(groupUser => groupUser !== null)
}

/**
 * Get the normal user ID from an external ID.
 * @param externalUserId The external user ID.
 * @param groupId The group to look in.
 * @return The normal user ID, or null if there is no user with the external ID in the group.
 */
export async function findUserByExternalId(
    externalUserId: string,
    groupId: number
): Promise<number | null> {
    return prisma.groupUser
        .findFirst({
            where: {
                externalId: externalUserId,
                groupId: groupId,
            },
            select: {
                userId: true,
            },
        })
        .then(groupUser => (groupUser ? groupUser.userId : null))
}

export interface GroupMemberUpdate {
    externalId?: number
}

export async function updateGroupMember(
    userId: number,
    groupId: number,
    update: GroupMemberUpdate
): Promise<void> {
    const updateData: GroupUserUpdateInput = {
        externalId: null,
    }

    Object.entries(update).forEach(([key, value]) => {
        if (value === undefined) return
        switch (key) {
            case 'externalId':
                updateData[key] = value
        }
    })

    await prisma.groupUser.update({
        where: {
            groupId_userId: {
                userId,
                groupId,
            },
        },
        data: updateData,
    })
}
