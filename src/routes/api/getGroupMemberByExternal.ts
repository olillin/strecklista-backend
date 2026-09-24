import type { Request, Response } from 'express'
import { getGammaGroupId, getGroupId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody } from '@/lib/responses.js'
import { getGroupUser, type GroupUser } from '@/services/gammaService.js'
import { findUserByExternalId } from '@/services/userService.js'

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.externalId !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const externalUserId = req.params.externalId
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

    const body = createResponseBody<GroupUser>(groupUser)
    res.json(body)
}
