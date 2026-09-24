import type { Request, Response } from 'express'
import { getGroupId, getUserId } from '@/lib/token.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { createResponseBody, type ItemResponse } from '@/lib/responses.js'
import * as itemService from '@/services/itemService.js'

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.externalId !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const externalItemId = req.params.externalId

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

    const body = createResponseBody<ItemResponse>({ item })
    res.json(body)
}
