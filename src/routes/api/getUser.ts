import { Request, Response } from 'express'
import { clientApi } from '../../config/gamma'
import {
    getGammaUserId,
    getGroupId,
    getUserId,
} from '../../middleware/validateToken'
import { ApiError, sendError } from '../../errors'
import {
    ResponseBody,
    GroupUserResponse,
    toGroupUserResponse,
} from '../../responses'
import { getAuthorizedGroup } from '../../util/helpers'
import * as userService from '../../services/userService'
import { completeGroupUser } from '../../services/gammaService'

export default async function getUser(req: Request, res: Response) {
    const userId = getUserId(res)
    const groupId = getGroupId(res)
    const gammaUserId = getGammaUserId(res)
    if (userId == null || groupId == null || gammaUserId == null) {
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
    const groupsPromise = clientApi.getGroupsFor(gammaUserId).catch(reason => {
        if (!res.headersSent) {
            console.log(reason)
            sendError(res, ApiError.FailedGetGroups)
        }
    })

    // Await promises
    const offlineGroupUser = await offlineGroupUserPromise
    if (!offlineGroupUser) {
        sendError(res, 404, 'User does not exist')
        return
    }
    const gammaUser = await gammaUserPromise
    if (!gammaUser) {
        sendError(res, 502, 'Failed to get user from gamma')
        return
    }
    const groups = await groupsPromise
    if (!groups) {
        sendError(res, 502, 'Failed to get groups from gamma')
        return
    }

    const group = getAuthorizedGroup(groups)
    if (!group) {
        sendError(res, ApiError.NoPermission)
        return
    }

    const groupUser = completeGroupUser(offlineGroupUser, gammaUser, group)

    const body: ResponseBody<GroupUserResponse> = {
        data: toGroupUserResponse(groupUser),
    }
    res.json(body)
}
