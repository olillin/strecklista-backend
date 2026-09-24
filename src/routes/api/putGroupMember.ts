import type { Request, Response } from 'express'
import { getGroupId } from '@/lib/token.js'
import { createResponseBody } from '@/lib/responses.js'
import { ApiError, sendError, unexpectedError } from '@/lib/errors.js'
import {
    updateGroupMember,
    type GroupMemberUpdate,
} from '@/services/userService.js'
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

    const update = req.body as GroupMemberUpdate
    await updateGroupMember(userId, groupId, update)
    const newGroupUser = await getGroupUser(userId, groupId)

    if (newGroupUser == null) {
        sendError(
            res,
            unexpectedError('Failed to fetch group user after update')
        )
        return
    }

    const body = createResponseBody<GroupUser>(newGroupUser)
    res.json(body)
}
