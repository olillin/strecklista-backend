import type { Request, Response } from 'express'
import { getGroupId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody } from '@/lib/responses.js'
import { getGroupUser, type GroupUser } from '@/services/gammaService.js'

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const userId = parseInt(req.params.id)
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
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
