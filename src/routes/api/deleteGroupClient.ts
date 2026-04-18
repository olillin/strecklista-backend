import type { Request, Response, NextFunction } from 'express'
import { getGroupId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import * as clientService from '@/services/clientService.js'

export default async function deleteGroupClient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (typeof req.params.id !== 'string') {
            throw new Error('Invalid id, expected string but got array')
        }
        const clientId = req.params.id
        const groupId = getGroupId(res)
        if (groupId == null) {
            sendError(res, ApiError.Unauthorized)
            return
        }

        const client = await clientService.getGroupClient(clientId, groupId)
        if (client == null) {
            sendError(res, ApiError.ClientNotExist)
            return
        }

        await clientService.deleteClient(clientId, groupId)
        res.status(204).end()
    } catch (error) {
        next(error)
    }
}
