import { GroupId, UserId } from 'gammait'
import { prisma } from "../lib/prisma"
import { Decimal } from '@prisma/client/runtime/client'
import { UserSelect } from '../generated/prisma/models'
import { PrismaClient } from '@prisma/client/extension'

export interface OfflineGroup {
    id: number
    gammaId: GroupId
}

export interface OfflineUser {
    id: number
    gammaId: UserId
    balance: Decimal
}

export interface OfflineGroupUser {
    user: OfflineUser
    group: OfflineGroup
}

// Groups
export async function createGroup(gammaGroupId: GroupId): Promise<OfflineGroup> {
    return prisma.group.create({
        data: {
            gammaId: gammaGroupId
        }
    }).then(group => ({
        id: group.id,
        gammaId: group.gammaId as GroupId
    } satisfies OfflineGroup))
}

/**
 * Create a group and user if they do not exist
 * @param gammaGroupId group id from Gamma
 * @param gammaUserId user id from Gamma
 * @return the full information of the user with `gammaUserId` in the group with `gammaGroupId`
 */
export async function softAddGroupUser(
    gammaGroupId: GroupId,
    gammaUserId: UserId
): Promise<OfflineGroupUser> {
    const createGroupUser = async (gammaGroupId: GroupId, gammaUserId: UserId, tx: PrismaClient): Promise<OfflineGroupUser> => {
        const groupUser = await tx.groupUser.create({
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
            },
            include: {
                group: {
                    select: {
                        gammaId: true
                    }
                }
            }
        })

        return {
            user: (await getUser(groupUser.userId, groupUser.groupId))!,
            group: {
                id: groupUser.groupId,
                gammaId: groupUser.group.gammaId as GroupId
            }
        }
    }

    return prisma.$transaction<OfflineGroupUser>(async (tx) => {
        const groupUser = await tx.groupUser.findFirst({
            where: {
                user: {
                    gammaId: gammaUserId,
                },
                group: {
                    gammaId: gammaGroupId,
                },
            }
        })
        if (groupUser != null) {
             const offlineGroupUser = await _getUserInGroup(groupUser.userId, groupUser.groupId, tx)
             if (offlineGroupUser == null) {
                 throw new Error("Group user is suddenly null")
             }
             return offlineGroupUser
        }
        return createGroupUser(gammaGroupId, gammaUserId, tx)
    })
}

async function _getUserInGroup(userId: number, groupId: number, tx: PrismaClient): Promise<OfflineGroupUser | null> {
    const groupUser = await tx.groupUser.findFirst({
        where: {
            userId: userId,
            groupId: groupId
        },
        include: {
            user: {
                select: selectUserData(groupId)
            },
            group: true
        }
    })
    if (groupUser === null) return null
    return {
        user: parseUser(groupUser.user),
        group: {
            id: groupUser.groupId,
            gammaId: groupUser.group.gammaId as GroupId
        }
    }
}

export async function getUserInGroup(userId: number, groupId: number): Promise<OfflineGroupUser | null> {
    return _getUserInGroup(userId, groupId, prisma)
}

export async function getGroup(groupId: number): Promise<OfflineGroup | null> {
    return prisma.group.findFirst({
        where: {
            id: groupId
        }
    }).then(group => {
        if (group === null) return null

        return {
            id: group.id,
            gammaId: group.gammaId as GroupId,
        } satisfies OfflineGroup
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
interface UserData {
    id: number
    gammaId: string
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
                    groupId: groupId
                }
            },
            select: {
                total: true
            }
        },
        receivedPurchases: {
            where: {
                transaction: {
                    groupId: groupId
                }
            },
            select: {
                items: {
                    select: {
                        purchasePrice: true,
                        quantity: true,
                    }
                }
            }
        },
    } satisfies UserSelect
}


function parseUser(user: UserData): OfflineUser {
    const totalDeposited: Decimal = user.receivedDeposits
        .reduce((sum, deposit) => sum.add(deposit.total), new Decimal(0))
    const totalPurchased: Decimal = user.receivedPurchases
        .reduce((sum, purchase) =>
            sum.add(purchase.items.reduce((purchaseSum, item) =>
                purchaseSum.add(item.purchasePrice.mul(item.quantity)), new Decimal(0))), new Decimal(0))
    const balance: Decimal = totalDeposited.sub(totalPurchased)

    return {
        id: user.id,
        gammaId: user.gammaId as UserId,
        balance: balance,
    }
}

export async function getUser(userId: number, groupId: number): Promise<OfflineUser | null> {
    const user: UserData | null = await prisma.user.findFirst({
        where: {
            id: userId
        },
        select: selectUserData(groupId)
    })
    if (user === null) return null
    return parseUser(user)
}

export async function getUserGroups(userId: number): Promise<OfflineGroup[] | null> {
    return prisma.groupUser.findMany({
        where: {
            userId: userId
        },
        select: {
            group: true
        }
    }).then(groupUsers => groupUsers.map(groupUser => ({
        id: groupUser.group.id,
        gammaId: groupUser.group.gammaId as GroupId,
    } satisfies OfflineGroup)))
}

export async function getUsersInGroup(groupId: number): Promise<OfflineUser[]> {
    const users: {user: UserData}[] = await prisma.groupUser.findMany({
        where: {
            groupId: groupId
        },
        select: {
            user: {
                select: selectUserData(groupId)
            }
        }
    })
    return users.map(groupUser => parseUser(groupUser.user))
}

export async function isUserInGroup(userId: number, groupId: number): Promise<boolean> {
    return prisma.groupUser.findFirst({
        where: {
            userId: userId,
            groupId: groupId
        }
    }).then(groupUser => groupUser !== null)
}

