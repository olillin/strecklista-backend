import {Request, Response} from "express";
import {ItemSortMode, ItemsResponse, ResponseBody} from "../../types";
import {getGroupId, getUserId} from "../../middleware/validateToken";
import {getItemsInGroup, Item} from "../../services/itemService"

type ItemCompareFunction = (a: Item, b: Item) => number
const COMPARE = {
    TIMES_PURCHASED_DESC: (a, b) => b.timesPurchased - a.timesPurchased,
    PRICE_ASC: (a, b) => a.prices[0].price.sub(b.prices[0].price).toNumber(),
    PRICE_DESC: (a, b) => b.prices[0].price.sub(a.prices[0].price).toNumber(),
    CREATED_TIME_ASC: (a, b) => a.createdTime.getTime() - b.createdTime.getTime(),
    CREATED_TIME_DESC: (a, b) => b.createdTime.getTime() - a.createdTime.getTime(),
    NAME_ASC: (a, b) => a.displayName.localeCompare(b.displayName),
    NAME_DESC: (a, b) => b.displayName.localeCompare(a.displayName),
    STOCK_ASC: (a, b) => a.stock - b.stock,
    STOCK_DESC: (a, b) => b.stock - a.stock,
} satisfies {[_: string]: ItemCompareFunction}

export default async function getItems(req: Request, res: Response) {
    const sort: ItemSortMode = req.query.sort as ItemSortMode
    const visibleOnly: boolean = req.query.visibleOnly === '1' || req.query.visibleOnly === 'true'

    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)

    const items: Item[] = (await getItemsInGroup(groupId, userId))
        .filter(item => item.visible || !visibleOnly)

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

    const body: ResponseBody<ItemsResponse> = {data: {items}}
    res.json(body)
}
