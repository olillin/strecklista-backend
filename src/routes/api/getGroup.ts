import type { Request, Response, NextFunction } from 'express'
import { clientApi } from '@/config/gamma.js'
import { getGammaGroupId, getGroupId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import type { GroupResponse, ResponseBody } from '@/responses.js'
import {
    getOfflineUsersInGroup,
    type OfflineGroup,
} from '@/services/userService.js'
import {
    completeUser,
    completeGroup,
    getGammaGroup,
    type GroupMember,
} from '@/services/gammaService.js'
import type { DecimalToNumber } from '@/util/decimalToNumber.js'

export default async function getGroup(
    _req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const groupId = getGroupId(res)
        const gammaGroupId = getGammaGroupId(res)
        if (groupId == null || gammaGroupId == null) {
            sendError(res, ApiError.Unauthorized)
            return
        }

        // Get group
        const gammaGroup = await getGammaGroup(gammaGroupId)
        if (!gammaGroup) {
            sendError(res, ApiError.FailedGetGroup)
            return
        }

        // Get members
        const offlineGroupUsers = await getOfflineUsersInGroup(groupId)
        let members: DecimalToNumber<GroupMember[]>
        try {
            members = await Promise.all(
                offlineGroupUsers.map(async offlineGroupUser => {
                    const gammaUser = await clientApi
                        .getUser(offlineGroupUser.user.gammaId)
                        .catch(() => null)
                    if (gammaUser === null) {
                        console.warn(
                            `Failed to get user ${offlineGroupUser.user.gammaId} in group ${gammaGroup.id} from Gamma`
                        )
                    }
                    const user = completeUser(offlineGroupUser.user, gammaUser)
                    return {
                        ...user,
                        balance: offlineGroupUser.balance.toNumber(),
                        externalId: offlineGroupUser.externalId,
                    } satisfies DecimalToNumber<GroupMember>
                })
            )
        } catch (e) {
            const message = `Failed to get users from gamma: ${e}`
            console.error(message)
            sendError(res, ApiError.InvalidGammaResponse)
            return
        }

        const offlineGroup: OfflineGroup = {
            id: groupId,
            gammaId: gammaGroupId,
        }
        const group = completeGroup(offlineGroup, gammaGroup)

        const body: ResponseBody<GroupResponse> = { data: { group, members } }
        res.json(body)
    } catch (error) {
        next(error)
    }
}
