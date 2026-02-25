import * as gamma from "gammait"
import { GroupId, UserId } from "gammait"
import { groupAvatarUrl, userAvatarUrl } from "gammait/urls"
import { OfflineGroup, OfflineUser } from "./userService"
import { Decimal } from "@prisma/client/runtime/client"

export interface Group {
    id: number
    gammaId: GroupId

    prettyName: string
    avatarUrl: string
}

export interface User {
    id: number
    gammaId: UserId

    firstName: string
    lastName: string
    nick: string
    avatarUrl: string

    balance: Decimal
}

export type GammaUser = gamma.User | gamma.UserInfo
export function isUserInfo(gammaUser: GammaUser): gammaUser is gamma.UserInfo {
    return 'sub' in gammaUser
}

export const NOT_AVAILABLE: string = "N/A"

export function completeGroup(offlineGroup: OfflineGroup, gammaGroup: gamma.Group | null): Group {
    return {
        id: offlineGroup.id,
        gammaId: offlineGroup.gammaId,
        prettyName: gammaGroup?.prettyName ?? NOT_AVAILABLE,
        avatarUrl: groupAvatarUrl(offlineGroup.gammaId),
    }
}

export function completeUser(offlineUser: OfflineUser, gammaUser: GammaUser | null): User {
    const names =
        gammaUser === null
            ? {
                  nick:NOT_AVAILABLE,
                  firstName:NOT_AVAILABLE,
                  lastName:NOT_AVAILABLE,
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
