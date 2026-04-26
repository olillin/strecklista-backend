import * as gamma from 'gammait'
import { groupAvatarUrl, userAvatarUrl } from 'gammait/urls'
import {
    getOfflineUser,
    getOfflineGroupUser,
    type OfflineGroup,
    type OfflineGroupUser,
    type OfflineUser,
} from '@/services/userService.js'
import { Decimal } from '@prisma/client/runtime/client'
import { clientApi } from '@/config/gamma.js'
import { prisma } from '@/lib/prisma.js'

export interface Group {
    id: number
    gammaId: gamma.GroupId

    prettyName: string
    avatarUrl: string
}

export interface User {
    id: number
    gammaId: gamma.UserId

    firstName: string
    lastName: string
    nick: string
    avatarUrl: string
}

export interface GroupUser {
    user: User
    group: Group
    balance: Decimal
    externalId?: number
}

export interface GroupMember extends User {
    balance: Decimal
    externalId?: number
}

export type GammaUser = gamma.User | gamma.UserInfo
export function isUserInfo(gammaUser: GammaUser): gammaUser is gamma.UserInfo {
    return 'sub' in gammaUser
}

export const NOT_AVAILABLE: string = 'N/A'

export function completeGroup(
    offlineGroup: OfflineGroup,
    gammaGroup: gamma.Group | null
): Group {
    return {
        id: offlineGroup.id,
        gammaId: offlineGroup.gammaId,
        prettyName: gammaGroup?.prettyName ?? NOT_AVAILABLE,
        avatarUrl: groupAvatarUrl(offlineGroup.gammaId),
    }
}

export async function getGammaGroup(
    id: gamma.GroupId
): Promise<gamma.Group | null> {
    const groupUser = await prisma.groupUser.findFirst({
        where: {
            group: {
                gammaId: id,
            },
        },
        select: {
            group: {
                select: {
                    gammaId: true,
                },
            },
            user: {
                select: {
                    gammaId: true,
                },
            },
        },
    })
    if (groupUser == null) return null

    const groups = await clientApi.getGroupsFor(
        groupUser.user.gammaId as gamma.UserId
    )
    const group = groups.find(group => group.id === groupUser.group.gammaId)
    if (group == null) return null

    return {
        id: group.id,
        name: group.name,
        prettyName: group.prettyName,
        superGroup: group.superGroup,
    }
}

export function completeUser(
    offlineUser: OfflineUser,
    gammaUser: GammaUser | null
): User {
    const names =
        gammaUser === null
            ? {
                  nick: NOT_AVAILABLE,
                  firstName: NOT_AVAILABLE,
                  lastName: NOT_AVAILABLE,
              }
            : isUserInfo(gammaUser)
              ? {
                    nick: gammaUser.nickname,
                    firstName: gammaUser.given_name,
                    lastName: gammaUser.family_name,
                }
              : {
                    nick: gammaUser.nick,
                    firstName: gammaUser.firstName,
                    lastName: gammaUser.lastName,
                }

    return {
        id: offlineUser.id,
        gammaId: offlineUser.gammaId ?? NOT_AVAILABLE,
        avatarUrl: userAvatarUrl(offlineUser.gammaId),
        ...names,
    }
}

export function completeGroupUser(
    offlineGroupUser: OfflineGroupUser,
    gammaUser: GammaUser | null,
    gammaGroup: gamma.Group | null
): GroupUser {
    const names =
        gammaUser === null
            ? {
                  nick: NOT_AVAILABLE,
                  firstName: NOT_AVAILABLE,
                  lastName: NOT_AVAILABLE,
              }
            : isUserInfo(gammaUser)
              ? {
                    nick: gammaUser.nickname,
                    firstName: gammaUser.given_name,
                    lastName: gammaUser.family_name,
                }
              : {
                    nick: gammaUser.nick,
                    firstName: gammaUser.firstName,
                    lastName: gammaUser.lastName,
                }

    return {
        user: {
            id: offlineGroupUser.user.id,
            gammaId: offlineGroupUser.user.gammaId,
            avatarUrl: userAvatarUrl(offlineGroupUser.user.gammaId),
            ...names,
        },
        group: {
            id: offlineGroupUser.group.id,
            gammaId: offlineGroupUser.group.gammaId,
            avatarUrl: groupAvatarUrl(offlineGroupUser.group.gammaId),
            prettyName: gammaGroup?.prettyName ?? NOT_AVAILABLE,
        },
        balance: offlineGroupUser.balance,
        externalId: offlineGroupUser.externalId ?? undefined,
    }
}

export async function getGroupUser(
    userId: number,
    groupId: number
): Promise<GroupUser | null> {
    const offlineGroupUser = await getOfflineGroupUser(userId, groupId)
    if (offlineGroupUser == null) return null

    const gammaUser = await clientApi
        .getUser(offlineGroupUser.user.gammaId)
        .catch(() => null)
    if (gammaUser == null) return null

    const gammaGroup = await clientApi
        .getGroupsFor(offlineGroupUser.user.gammaId)
        .then(groups =>
            groups.find(group => group.id === offlineGroupUser.group.gammaId)
        )
        .catch(() => null)
    if (gammaGroup == null) return null

    return completeGroupUser(offlineGroupUser, gammaUser, gammaGroup)
}

export async function getUser(userId: number): Promise<User | null> {
    const offlineUser = await getOfflineUser(userId)
    if (offlineUser == null) return null
    const gammaUser = await clientApi
        .getUser(offlineUser.gammaId)
        .catch(() => null)
    return completeUser(offlineUser, gammaUser)
}
