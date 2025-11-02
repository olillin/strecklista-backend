import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { ApiError } from '../../errors'

export default async function deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const itemId = parseInt(req.params.id)

    await database
        .deleteItem(itemId)
        .then(() => {
            res.status(204).end()
        })
        .catch(reason => {
            console.error(
                `Failed to delete item ${itemId} from database: ${reason}`
            )
            next(ApiError.Unexpected)
        })
}
