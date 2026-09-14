import type { Request, Response } from 'express'
import { clientApi } from '@/config/gamma.js'
import {
    getGammaGroupId,
    getGammaUserId,
    getGroupId,
    getUserId,
} from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import {
    type ResponseBody,
    type GroupUserResponse,
    toGroupUserResponse,
} from '@/responses.js'
import * as userService from '@/services/userService.js'
import { completeGroupUser, getGammaGroup } from '@/services/gammaService.js'

export default async function getUser(_req: Request, res: Response) {
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

    const body: ResponseBody<GroupUserResponse> = {
        data: toGroupUserResponse(groupUser),
    }
    res.json(body)
}
