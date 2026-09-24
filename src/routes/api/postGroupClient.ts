import type { Request, Response } from 'express'
import {
    createResponseBody,
    type NewGroupClientResponse,
} from '@/lib/responses.js'
import { getGroupId, getUserId } from '@/lib/token.js'
import { createGroupClient, parseScope } from '@/services/clientService.js'
import { ApiError, sendError } from '@/lib/errors.js'

export interface PostClientBody {
    scope: string
    displayName: string
    description?: string
}

export default async function routeHandler(req: Request, res: Response) {
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

    const body = createResponseBody<NewGroupClientResponse>({ client })
    const resourceUri = req.baseUrl + `/group/client/${client.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
