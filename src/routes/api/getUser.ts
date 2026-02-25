import {Request, Response} from "express";
import {clientApi} from "../../config/gamma";
import {getGammaUserId, getGroupId, getUserId} from "../../middleware/validateToken";
import {ApiError, sendError} from "../../errors";
import {ResponseBody, UserResponse} from "../../types";
import {UserId} from "gammait";
import {getAuthorizedGroup} from "../../util/helpers";
import * as userService from '../../services/userService'

export default async function getUser(req: Request, res: Response) {
    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)
    const gammaUserId: UserId = getGammaUserId(res)
    console.log(`Getting user info for: ${userId}`)

    // Get requests
    const offlineUserPromise = userService.getUser(userId, groupId).catch(reason => {
        if (!res.headersSent) {
            console.log(reason)
            sendError(res, 500, 'Failed to fetch user from database')
        }
    })
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
    const offlineUser = await offlineUserPromise
    if (!offlineUser) {
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

    const body: ResponseBody<UserResponse> = {
        data: convert.toUserResponse(dbUser, gammaUser, group),
    }
    res.json(body)
}
