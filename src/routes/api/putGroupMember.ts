import type { Request, Response } from 'express'
import { getGroupId } from '@/middleware/validateToken.js'
import {
    toGroupUserResponse,
    type GroupUserResponse,
    type ResponseBody,
} from '@/responses.js'
import { ApiError, sendError, unexpectedError } from '@/errors.js'
import {
    updateGroupMember,
    type GroupMemberUpdate,
} from '@/services/userService.js'
import { getGroupUser } from '@/services/gammaService.js'

export default async function putGroupMember(req: Request, res: Response) {
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

    const body: ResponseBody<GroupUserResponse> = {
        data: toGroupUserResponse(newGroupUser),
    }
    res.json(body)
}
