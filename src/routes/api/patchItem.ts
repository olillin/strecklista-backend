import type { Request, Response } from 'express'
import { getUserId } from '@/middleware/validateToken.js'
import type { ItemResponse, ResponseBody } from '@/responses.js'
import {
    updateItem,
    type Price,
    type ItemPatch,
} from '@/services/itemService.js'
import type { JsonPrice } from '@/routes/api/postPurchase.js'
import { Decimal } from '@prisma/client/runtime/client'
import { convertDecimalToNumber } from '@/util/decimalToNumber.js'

export interface PatchItemBody {
    icon?: string
    displayName?: string
    prices?: JsonPrice[]
    visible?: boolean
    favorite?: boolean
}

export default async function patchItem(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }

    const itemId = parseInt(req.params.id)
    const userId = getUserId(res)
    const patch = createItemPatch(req.body as PatchItemBody)

    const newItem = await updateItem(itemId, patch, userId)

    const body: ResponseBody<ItemResponse> = {
        data: { item: convertDecimalToNumber(newItem) },
    }
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
