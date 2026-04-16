import { Request, Response } from 'express'
import { NewGroupClientResponse, ResponseBody } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { createGroupClient, parseScope } from '../../services/clientService'
import { ApiError, sendError } from '../../errors'

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
