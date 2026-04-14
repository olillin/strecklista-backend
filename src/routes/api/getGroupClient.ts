import { Request, Response } from 'express'
import { GroupClientResponse, ResponseBody } from '../../responses'
import * as clientService from '../../services/clientService'
import { ApiError } from '../../errors'

export interface GetClientParams {
    id: string
}

export default async function getGroupClient(req: Request, res: Response) {
    const id = req.params.id as string
    const groupClient = await clientService.getGroupClient(id)
    if (groupClient == null) {
        throw ApiError.ClientNotExist
    }

    const body: ResponseBody<GroupClientResponse> = {
        data: {
            id: groupClient.id,
            scope: groupClient.scope.join(' '),
            displayName: groupClient.displayName,
            group: groupClient.group,
            owner: groupClient.owner,
            ...(groupClient.description == null
                ? {}
                : { description: groupClient.description }),
        },
    }
    res.status(200).json(body)
}
