import type { Request, Response } from 'express'
import type { NewGroupClientResponse, ResponseBody } from '@/responses.js'
import { getGroupId, getUserId } from '@/middleware/validateToken.js'
import { createGroupClient, parseScope } from '@/services/clientService.js'
import { ApiError, sendError } from '@/errors.js'

export interface PostClientBody {
    scope: string
    displayName: string
    description?: string
}

export default async function postClient(req: Request, res: Response) {
    const { scope, displayName, description } = req.body as PostClientBody
    const userId = getUserId(res)
    const groupId = getGroupId(res)
    if (userId == null || groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const parsedScope = parseScope(scope)
    const client = await createGroupClient(
        groupId,
        userId,
        parsedScope,
        displayName,
        description
    )

    const body: ResponseBody<NewGroupClientResponse> = {
        data: {
            ...client,
            scope: client.scope.join(' '),
        },
    }
    const resourceUri = req.baseUrl + `/group/client/${client.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
