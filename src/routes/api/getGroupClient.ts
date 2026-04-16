import type { Request, Response } from 'express'
import type { GroupClientResponse, ResponseBody } from '@/responses.js'
import * as clientService from '@/services/clientService.js'
import { ApiError, sendError } from '@/errors.js'

export interface GetClientParams {
    id: string
}

export default async function getGroupClient(req: Request, res: Response) {
    const id = req.params.id as string
    const groupClient = await clientService.getGroupClient(id)
    if (groupClient == null) {
        sendError(res, ApiError.ClientNotExist)
        return
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
