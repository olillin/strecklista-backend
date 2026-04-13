import { Request, Response } from 'express'
import { NewClientResponse, ResponseBody } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { createClient, parseScope } from '../../services/clientService'
import { unexpectedError } from '../../errors'

export interface PostClientBody {
    scope: string
    displayName: string
    description?: string
}

export default async function postItem(req: Request, res: Response) {
    const { scope, displayName, description } = req.body as PostClientBody
    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)

    const parsedScope = parseScope(scope)
    const client = await createClient(
        groupId,
        userId,
        parsedScope,
        displayName,
        description
    )

    const body: ResponseBody<NewClientResponse> = {
        data: {
            ...client,
            scope: client.scope.join(' '),
        },
    }
    const resourceUri = req.baseUrl + `/group/client/${client.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
