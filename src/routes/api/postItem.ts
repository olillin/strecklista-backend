import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { Item, ItemResponse, PostItemBody, ResponseBody } from '../../types'

export default async function postItem(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { displayName, prices, icon } = req.body as PostItemBody
    const userId: number = getUserId(res)
    const groupId: number = getGroupId(res)

    // Create item
    const item: Item = await database.createItem(
        groupId,
        userId,
        displayName,
        prices,
        icon
    )

    const body: ResponseBody<ItemResponse> = { data: { item } }

    const resourceUri = req.baseUrl + `/group/item/${item.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
