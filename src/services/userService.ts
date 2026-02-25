import {GroupId, UserId} from 'gammait'
import { prisma } from "../lib/prisma"
import type { Group, User, GroupUser } from "../../generated/prisma/client"

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

export async function isUserInGroup(userId: number, groupId: number): Promise<boolean> {
    return prisma.groupUser.findFirst({
        where: {
            userId: userId,
            groupId: groupId
        }
    }).then(groupUser => groupUser !== null)
}

