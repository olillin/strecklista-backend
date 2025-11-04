import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { ApiError } from '../../errors'
import { getUserId } from '../../middleware/validateToken'
import { ItemResponse, ResponseBody } from '../../types'
import * as convert from '../../util/convert'

export default async function getItem(req: Request, res: Response) {
    const reqParams = matchedData(req, { locations: ['params'] })
    const itemId = parseInt(reqParams.id)
    const userId: number = getUserId(res)

    const dbItemWithPrices = await database.getFullItemWithPrices(
        itemId,
        userId
    )

    if (dbItemWithPrices.length === 0) {
        throw ApiError.ItemNotExist
    }

    const data: ItemResponse = {
        item: convert.toItem(dbItemWithPrices),
    }
    const body: ResponseBody<ItemResponse> = { data }

    res.json(body)
}
