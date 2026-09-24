import type { Request, Response } from 'express'
import { getUserId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody, type ItemResponse } from '@/lib/responses.js'
import * as itemService from '@/services/itemService.js'

export default async function routeHandler(req: Request, res: Response) {
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

    const body = createResponseBody<ItemResponse>({ item })
    res.json(body)
}
