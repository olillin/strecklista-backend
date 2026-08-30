import type { Request, Response } from 'express'
import { getGammaGroupId, getGroupId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import {
    type ResponseBody,
    type GroupUserResponse,
    toGroupUserResponse,
} from '@/responses.js'
import { getGroupUser } from '@/services/gammaService.js'
import { findUserByExternalId } from '@/services/userService.js'

export default async function getGroupMemberByExternal(
    req: Request,
    res: Response
) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const externalUserId = req.params.id
    const groupId = getGroupId(res)
    const gammaGroupId = getGammaGroupId(res)
    if (groupId == null || gammaGroupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    // Resolve external ID
    const userId = await findUserByExternalId(externalUserId, groupId)
    if (userId == null) {
        sendError(res, ApiError.UserNotExist)
        return
    }

    const groupUser = await getGroupUser(userId, groupId)
    if (groupUser == null) {
        sendError(res, ApiError.UserNotExist)
        return
    }

    const body: ResponseBody<GroupUserResponse> = {
        data: toGroupUserResponse(groupUser),
    }
    res.json(body)
}
