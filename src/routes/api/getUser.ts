import type { Request, Response } from 'express'
import { clientApi } from '@/lib/gamma.js'
import {
    getGammaGroupId,
    getGammaUserId,
    getGroupId,
    getUserId,
} from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody } from '@/lib/responses.js'
import * as userService from '@/services/userService.js'
import {
    completeGroupUser,
    getGammaGroup,
    type GroupUser,
} from '@/services/gammaService.js'

export default async function routeHandler(_req: Request, res: Response) {
    const userId = getUserId(res)
    const groupId = getGroupId(res)
    const gammaUserId = getGammaUserId(res)
    const gammaGroupId = getGammaGroupId(res)
    if (
        userId == null ||
        groupId == null ||
        gammaUserId == null ||
        gammaGroupId == null
    ) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    // Get requests
    const offlineGroupUserPromise = userService.getOfflineGroupUser(
        userId,
        groupId
    )
    const gammaUserPromise = clientApi.getUser(gammaUserId).catch(reason => {
        if (!res.headersSent) {
            console.log(reason)
            sendError(res, ApiError.UserNotExist)
        }
    })
    const groupPromise = getGammaGroup(gammaGroupId).catch(reason => {
        if (!res.headersSent) {
            console.log(reason)
            sendError(res, ApiError.FailedGetGroup)
        }
    })

    // Await promises
    const offlineGroupUser = await offlineGroupUserPromise
    if (!offlineGroupUser) {
        sendError(res, ApiError.UserNotExist)
        return
    }
    const gammaUser = await gammaUserPromise
    if (!gammaUser) {
        sendError(res, ApiError.FailedGetUser)
        return
    }
    const group = await groupPromise
    if (!group) {
        sendError(res, ApiError.FailedGetGroup)
        return
    }

    const groupUser = completeGroupUser(offlineGroupUser, gammaUser, group)

    const body = createResponseBody<GroupUser>(groupUser)
    res.json(body)
}
