import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { getUserId } from '../../middleware/validateToken'
import { ApiError } from '../../errors'
import { ItemResponse, ResponseBody } from '../../types'
import * as convert from '../../util/convert'

export default async function getItem(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const itemId = parseInt(req.params.id)
    const userId: number = getUserId(res)

    const dbItemWithPrices = await database.getFullItemWithPrices(
        itemId,
        userId
    )

    if (dbItemWithPrices.length === 0) {
        return next(ApiError.ItemNotExist)
    }

    const data: ItemResponse = {
        item: convert.toItem(dbItemWithPrices),
    }
    const body: ResponseBody<ItemResponse> = { data }

    res.json(body)
}
