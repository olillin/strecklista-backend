import type { Request, Response } from 'express'
import {
    createResponseBody,
    type GroupClientListResponse,
} from '@/lib/responses.js'
import * as clientService from '@/services/clientService.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { getGroupId } from '@/lib/token.js'

export default async function routeHandler(_req: Request, res: Response) {
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }
    const clients = await clientService.getGroupClients(groupId)

    const body = createResponseBody<GroupClientListResponse>({
        clients: clients,
    })
    res.status(200).json(body)
}
