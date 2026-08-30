import type { Request, Response } from 'express'
import type { GroupClientResponse, ResponseBody } from '@/responses.js'
import * as clientService from '@/services/clientService.js'
import { ApiError, sendError } from '@/errors.js'
import { getGroupId } from '@/middleware/validateToken.js'

export interface GetClientParams {
    id: string
}

export default async function getGroupClient(req: Request, res: Response) {
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

    const body: ResponseBody<GroupClientResponse> = {
        data: { client: groupClient },
    }
    res.status(200).json(body)
}
