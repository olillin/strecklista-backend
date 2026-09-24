import type { Request, Response, NextFunction } from 'express'
import { getGroupId, getUserId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import * as clientService from '@/services/clientService.js'

export default async function routeHandler(
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

        // Require user token (not client token) for client deletion
        const userId = getUserId(res)
        if (userId == null) {
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
