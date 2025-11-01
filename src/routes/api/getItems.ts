import {NextFunction, Request, Response} from "express";
import {database} from "../../config/clients";
import {ItemSortMode, ItemsResponse, ResponseBody} from "../../types";
import {getGroupId, getUserId} from "../../middleware/validateToken";
import * as convert from "../../util/convert";
import {getFlag, ItemFlags} from "../../flags";

export default async function getItems(req: Request, res: Response, next: NextFunction) {
    const sort: ItemSortMode = req.query.sort as ItemSortMode
    const visibleOnly: boolean = req.query.visibleOnly === '1' || req.query.visibleOnly === 'true'

    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)

    const dbFullItemsWithPrices = await database.getFullItemsWithPricesInGroup(groupId, userId)
    const visibleItems = dbFullItemsWithPrices
        .filter(dbItem => !(getFlag(dbItem.flags, ItemFlags.INVISIBLE) && visibleOnly))
    const groupedItems = Map.groupBy(visibleItems, (dbItem) => dbItem.id)
    const items = Array.from(groupedItems.values())
        .map(dbFullItemWithPrices => convert.toItem(dbFullItemWithPrices))

    // Sort by popularity by default and when two items are equal in order
    items.sort((a, b) => b.timesPurchased - a.timesPurchased)
    switch (sort) {
        case 'popular':
            break
        case 'cheap':
            items.sort((a, b) => a.prices[0].price - b.prices[0].price)
            break
        case 'expensive':
            items.sort((a, b) => b.prices[0].price - a.prices[0].price)
            break
        case 'new':
            items.sort((a, b) => a.createdTime - b.createdTime)
            break
        case 'old':
            items.sort((a, b) => b.createdTime - a.createdTime)
            break
        case 'name_a2z':
            items.sort((a, b) => a.displayName.localeCompare(b.displayName))
            break
        case 'name_z2a':
            items.sort((a, b) => b.displayName.localeCompare(a.displayName))
            break
        case 'high_stock':
            items.sort((a, b) => b.stock - a.stock)
            break
        case 'low_stock':
            items.sort((a, b) => a.stock - b.stock)
            break
    }
    const body: ResponseBody<ItemsResponse> = {data: {items}}
    res.json(body)
    next()
}