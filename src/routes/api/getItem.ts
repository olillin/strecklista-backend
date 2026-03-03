import { Request, Response } from 'express'
import { getUserId } from '../../middleware/validateToken'
import { ApiError, sendError } from '../../errors'
import { ItemResponse, ResponseBody } from '../../responses'
import * as itemService from '../../services/itemService'

export default async function getItem(req: Request, res: Response) {
    const itemId = parseInt(req.params.id)
    const userId: number = getUserId(res)

    const item = await itemService.getItem(itemId, userId)

    if (item === null) {
        sendError(res, ApiError.ItemNotExist)
        return
    }

    const body: ResponseBody<ItemResponse> = { data: { item } }
    res.json(body)
}
