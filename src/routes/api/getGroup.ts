import type { Request, Response, NextFunction } from 'express'
import { clientApi } from '@/lib/gamma.js'
import { getGammaGroupId, getGroupId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody, type GroupResponse } from '@/lib/responses.js'
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

export default async function routeHandler(
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
        let members: GroupMember[]
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
                        balance: offlineGroupUser.balance,
                        externalId: offlineGroupUser.externalId,
                    }
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

        const body = createResponseBody<GroupResponse>({ group, members })
        res.json(body)
    } catch (error) {
        next(error)
    }
}
