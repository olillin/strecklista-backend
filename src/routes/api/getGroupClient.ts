import type { Request, Response } from 'express'
import {
    createResponseBody,
    type GroupClientResponse,
} from '@/lib/responses.js'
import * as clientService from '@/services/clientService.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { getGroupId } from '@/lib/token.js'

export interface GetClientParams {
    id: string
}

export default async function routeHandler(req: Request, res: Response) {
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const id = req.params.id as string

    const groupClient = await clientService.getGroupClient(id, groupId)
    if (groupClient == null) {
        sendError(res, ApiError.ClientNotExist)
        return
    }

    const body = createResponseBody<GroupClientResponse>({
        client: groupClient,
    })
    res.status(200).json(body)
}
