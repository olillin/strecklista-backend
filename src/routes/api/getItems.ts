import type { Request, Response } from 'express'
import type { ItemsResponse, ResponseBody } from '@/responses.js'
import { getGroupId, getUserId } from '@/middleware/validateToken.js'
import {
    getItemsInGroup,
    getTopPrice,
    type Item,
} from '@/services/itemService.js'
import type { ItemSortMode } from '@/middleware/validators.js'
import { convertDecimalToNumber } from '@/util/decimalToNumber.js'
import { ApiError, sendError } from '@/errors.js'

type ItemCompareFunction = (a: Item, b: Item) => number
const COMPARE = {
    TIMES_PURCHASED_DESC: (a, b) => b.timesPurchased - a.timesPurchased,
    PRICE_ASC: (a, b) => getTopPrice(a).sub(getTopPrice(b)).toNumber(),
    PRICE_DESC: (a, b) => getTopPrice(b).sub(getTopPrice(a)).toNumber(),
    CREATED_TIME_ASC: (a, b) =>
        a.createdTime.getTime() - b.createdTime.getTime(),
    CREATED_TIME_DESC: (a, b) =>
        b.createdTime.getTime() - a.createdTime.getTime(),
    NAME_ASC: (a, b) => a.displayName.localeCompare(b.displayName),
    NAME_DESC: (a, b) => b.displayName.localeCompare(a.displayName),
    STOCK_ASC: (a, b) => a.stock - b.stock,
    STOCK_DESC: (a, b) => b.stock - a.stock,
} satisfies { [_: string]: ItemCompareFunction }

export default async function getItems(req: Request, res: Response) {
    const sort: ItemSortMode = req.query.sort as ItemSortMode
    const visibleOnly: boolean =
        req.query.visibleOnly === '1' || req.query.visibleOnly === 'true'

    const userId = getUserId(res)
    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const items: Item[] = await getItemsInGroup(groupId, userId, visibleOnly)

    // Sort by popularity by default and when two items are equal in order
    items.sort(COMPARE.TIMES_PURCHASED_DESC)
    const compare: ItemCompareFunction | undefined = {
        popular: undefined,
        cheap: COMPARE.PRICE_ASC,
        expensive: COMPARE.PRICE_DESC,
        new: COMPARE.CREATED_TIME_DESC,
        old: COMPARE.CREATED_TIME_ASC,
        name_a2z: COMPARE.NAME_ASC,
        name_z2a: COMPARE.NAME_DESC,
        high_stock: COMPARE.STOCK_DESC,
        low_stock: COMPARE.STOCK_ASC,
    }[sort]
    if (compare !== undefined) {
        items.sort(compare)
    }

    const body: ResponseBody<ItemsResponse> = {
        data: { items: convertDecimalToNumber(items) },
    }
    res.json(body)
}
