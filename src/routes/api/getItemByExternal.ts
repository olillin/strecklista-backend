import type { Request, Response } from 'express'
import { getGroupId, getUserId } from '@/middleware/validateToken.js'
import { ApiError, sendError } from '@/errors.js'
import type { ItemResponse, ResponseBody } from '@/responses.js'
import * as itemService from '@/services/itemService.js'
import { convertDecimalToNumber } from '@/util/decimalToNumber.js'

export default async function getItemByExternal(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const externalItemId = parseInt(req.params.id)

    const groupId = getGroupId(res)
    const userId = getUserId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const item = await itemService.getItemByExternal(
        externalItemId,
        groupId,
        userId
    )

    if (item === null) {
        sendError(res, ApiError.ItemNotExist)
        return
    }

    const body: ResponseBody<ItemResponse> = {
        data: { item: convertDecimalToNumber(item) },
    }
    res.json(body)
}
