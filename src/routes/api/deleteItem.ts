import { NextFunction, Request, Response } from 'express'
import * as itemService from '../../services/itemService'
import { getGroupId } from '../../middleware/validateToken'

export default async function deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const itemId = parseInt(req.params.id)
        const groupId = getGroupId(res)

        await itemService.deleteItem(itemId, groupId)
        res.status(204).end()
    } catch (error) {
        next(error)
    }
}
