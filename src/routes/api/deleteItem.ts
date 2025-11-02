import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'

export default async function deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const itemId = parseInt(req.params.id)

        await database.deleteItem(itemId)
        res.status(204).end()
    } catch (error) {
        next(error)
    }
}
