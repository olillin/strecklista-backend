import * as gamma from 'gammait'
import { GroupId, UserId } from 'gammait'
import { groupAvatarUrl, userAvatarUrl } from 'gammait/urls'
import {
    getGroup,
    getUserInGroup,
    OfflineGroup,
    OfflineUser,
} from './userService'
import { Decimal } from '@prisma/client/runtime/client'
import { clientApi } from '../config/gamma'
import { getAuthorizedGroup } from '../util/helpers'

export interface Group {
    id: number
    gammaId: GroupId

    prettyName: string
    avatarUrl: string
}

export interface UserProfile {
    id: number
    gammaId: UserId

    firstName: string
    lastName: string
    nick: string
    avatarUrl: string
}

export interface User extends UserProfile {
    balance: Decimal
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
        balance: offlineUser.balance,
        ...names,
    }
}

export async function getCompleteUser(
    userId: number,
    groupId: number
): Promise<User | null> {
    const offlineGroupUser = await getUserInGroup(userId, groupId)
    if (offlineGroupUser == null) return null

    const gammaUser = await clientApi
        .getUser(offlineGroupUser.user.gammaId)
        .catch(() => null)
    if (gammaUser == null) return null
    return completeUser(offlineGroupUser.user, gammaUser)
}

export async function getCompleteAuthorizedGroup(
    groupId: number,
    gammaUserId: UserId
): Promise<Group | null> {
    const offlineGroup = await getGroup(groupId)
    if (offlineGroup == null) return null

    const gammaGroup = await clientApi
        .getGroupsFor(gammaUserId)
        .then(groups => getAuthorizedGroup(groups))
        .catch(() => null)
    if (gammaGroup == null) return null

    return completeGroup(offlineGroup, gammaGroup)
}
