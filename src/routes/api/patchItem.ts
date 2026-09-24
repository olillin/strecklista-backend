import type { Request, Response } from 'express'
import { getUserId, getGroupId } from '@/lib/token.js'
import { createResponseBody, type ItemResponse } from '@/lib/responses.js'
import {
    updateItem,
    type Price,
    type ItemPatch,
} from '@/services/itemService.js'
import type { JsonPrice } from '@/routes/api/postPurchase.js'
import { Decimal } from '@prisma/client/runtime/client'
import { ApiError, sendError } from '@/lib/errors.js'

export interface PatchItemBody {
    icon?: string
    displayName?: string
    prices?: JsonPrice[]
    visible?: boolean
    favorite?: boolean
}

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }

    const itemId = parseInt(req.params.id)
    const patch = createItemPatch(req.body as PatchItemBody)

    const userId = getUserId(res)
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const newItem = await updateItem(groupId, itemId, patch, userId)

    const body = createResponseBody<ItemResponse>({ item: newItem })
    res.json(body)
}

function createItemPatch(body: PatchItemBody): ItemPatch {
    const { icon, displayName, visible, favorite, prices: jsonPrices } = body
    const prices = jsonPrices?.map(
        price =>
            ({
                displayName: price.displayName,
                price: new Decimal(price.price),
                externalId: price.externalId,
            }) satisfies Price
    )
    return {
        displayName,
        iconUrl: icon,
        prices,
        favorite,
        invisible: visible != undefined ? !visible : undefined,
    }
}
