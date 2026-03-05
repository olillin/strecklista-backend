import { Request, Response } from 'express'
import { getUserId } from '../../middleware/validateToken'
import { ApiError, sendError } from '../../errors'
import { ItemResponse, ResponseBody } from '../../responses'
import * as itemService from '../../services/itemService'
import { convertDecimalToNumber } from '../../util/decimalToNumber'

export default async function getItem(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const itemId = parseInt(req.params.id)
    const userId: number = getUserId(res)

    const item = await itemService.getItem(itemId, userId)

    if (item === null) {
        sendError(res, ApiError.ItemNotExist)
        return
    }

    const body: ResponseBody<ItemResponse> = {
        data: { item: convertDecimalToNumber(item) },
    }
    res.json(body)
}
