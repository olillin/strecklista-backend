import type { Request, Response } from 'express'
import type { GroupClientsResponse, ResponseBody } from '@/responses.js'
import * as clientService from '@/services/clientService.js'
import { ApiError, sendError } from '@/errors.js'
import { getGroupId } from '@/middleware/validateToken.js'

export default async function getGroupClients(_req: Request, res: Response) {
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }
    const clients = await clientService.getGroupClients(groupId)

    const body: ResponseBody<GroupClientsResponse> = {
        data: { clients: clients },
    }
    res.status(200).json(body)
}
