import type { Request, Response } from 'express'
import { getUserId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import type { ItemResponse, ResponseBody } from '@/responses.js'
import * as itemService from '@/services/itemService.js'
import { convertToJson } from '@/util/convertToJson.js'

export default async function getItem(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const itemId = parseInt(req.params.id)
    const userId = getUserId(res)

    const item = await itemService.getItem(itemId, userId)

    if (item === null) {
        sendError(res, ApiError.ItemNotExist)
        return
    }

    const body: ResponseBody<ItemResponse> = {
        data: { item: convertToJson(item) },
    }
    res.json(body)
}
