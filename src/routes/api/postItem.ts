import {Request, Response} from "express";
import {ItemResponse, ResponseBody} from "../../responses";
import {getGroupId} from "../../middleware/validateToken";
import { createItem, Item, Price } from "../../services/itemService";
import { JsonPrice } from "./postPurchase";
import { Decimal } from "@prisma/client/runtime/client";

export interface PostItemBody {
    displayName: string
    prices: JsonPrice[]
    icon?: string
}

export default async function postItem(req: Request, res: Response) {
    const { displayName, prices: jsonPrices, icon } = req.body as PostItemBody
    const groupId: number = getGroupId(res)

    const prices = jsonPrices.map(price => ({
        displayName: price.displayName,
        price: new Decimal(price.price)
    } satisfies Price))
    const item: Item = await createItem(groupId, displayName, prices, icon) //

    const body: ResponseBody<ItemResponse> = { data: { item } }
    const resourceUri = req.baseUrl + `/group/item/${item.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
