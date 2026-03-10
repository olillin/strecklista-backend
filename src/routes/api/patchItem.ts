import { Request, Response } from 'express'
import { getUserId } from '../../middleware/validateToken'
import { ItemResponse, ResponseBody } from '../../responses'
import { updateItem, Price, ItemPatch } from '../../services/itemService'
import { JsonPrice } from './postPurchase'
import { Decimal } from '@prisma/client/runtime/client'
import { convertDecimalToNumber } from '../../util/decimalToNumber'

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
    const userId: number = getUserId(res)
    const itemId = parseInt(req.params.id)

    const patch = createItemPatch(req.body as PatchItemBody)
    const newItem = await updateItem(itemId, userId, patch)

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
