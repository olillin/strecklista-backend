import type { Request, Response, NextFunction } from 'express'
import * as itemService from '@/services/itemService.js'
import { getGroupId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'

export default async function deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (typeof req.params.id !== 'string') {
            throw new Error('Invalid id, expected string but got array')
        }
        const itemId = parseInt(req.params.id)
        const groupId = getGroupId(res)
        if (groupId == null) {
            sendError(res, ApiError.Unauthorized)
            return
        }

        await itemService.deleteItem(itemId, groupId)
        res.status(204).end()
    } catch (error) {
        next(error)
    }
}
