import type { Request, Response } from 'express'
import { createResponseBody, type ItemResponse } from '@/lib/responses.js'
import { getGroupId, getUserId } from '@/lib/token.js'
import { createItem, type Item, type Price } from '@/services/itemService.js'
import type { JsonPrice } from '@/routes/api/postPurchase.js'
import { Decimal } from '@prisma/client/runtime/client'
import { ApiError, sendError } from '@/lib/errors.js'

export interface PostItemBody {
    displayName: string
    prices: JsonPrice[]
    icon?: string
}

export default async function routeHandler(req: Request, res: Response) {
    const { displayName, prices: jsonPrices, icon } = req.body as PostItemBody
    const userId = getUserId(res)
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const prices = jsonPrices.map(
        price =>
            ({
                displayName: price.displayName,
                price: new Decimal(price.price),
                externalId: price.externalId,
            }) satisfies Price
    )
    const item: Item = await createItem(
        groupId,
        displayName,
        prices,
        icon,
        userId
    )

    const body = createResponseBody<ItemResponse>({ item })
    const resourceUri = req.baseUrl + `/group/item/${item.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
