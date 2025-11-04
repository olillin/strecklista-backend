import { NextFunction, Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { ApiError } from '../../errors'

export default async function deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const requestData = matchedData(req, { locations: ['params'] })
    const itemId = parseInt(requestData.id)

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
