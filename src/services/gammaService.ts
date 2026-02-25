import * as gammait from "gammait"
import { GroupId, UserId } from "gammait"
import { OfflineGroup, OfflineUser } from "./userService"
import { groupAvatarUrl, userAvatarUrl } from "gammait/urls"
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

export const NOT_AVAILABLE: string = "N/A"

export function completeGroup(offlineGroup: OfflineGroup, gammaGroup: gammait.Group | null): Group {
    return {
        id: offlineGroup.id,
        gammaId: offlineGroup.gammaId,
        prettyName: gammaGroup?.prettyName ?? NOT_AVAILABLE,
        avatarUrl: groupAvatarUrl(offlineGroup.gammaId),
    }
}

export function completeUser(offlineUser: OfflineUser, gammaUser: gammait.User | null): User {
    return {
        id: offlineUser.id,
        gammaId: offlineUser.gammaId ?? NOT_AVAILABLE,
        firstName: gammaUser?.firstName ?? NOT_AVAILABLE,
        lastName: gammaUser?.lastName ?? NOT_AVAILABLE,
        nick: gammaUser?.nick ?? NOT_AVAILABLE,
        avatarUrl: userAvatarUrl(offlineUser.gammaId),
        balance: offlineUser.balance,
    }
}
