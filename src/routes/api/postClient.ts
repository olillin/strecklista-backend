import { Request, Response } from 'express'
import { NewClientResponse, ResponseBody } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { createClient, parseScopes } from '../../services/clientService'

export interface PostClientBody {
    scopes: string
    displayName: string
    description?: string
}

export default async function postItem(req: Request, res: Response) {
    const { scopes, displayName, description } = req.body as PostClientBody
    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)

    const parsedScopes = parseScopes(scopes)
    const client = await createClient(
        groupId,
        userId,
        parsedScopes,
        displayName,
        description
    )

    const body: ResponseBody<NewClientResponse> = {
        data: {
            ...client,
            scopes: client.scopes.join(' '),
        },
    }
    const resourceUri = req.baseUrl + `/group/client/${client.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
