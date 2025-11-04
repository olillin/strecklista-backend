import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { Item, ItemResponse, PostItemBody, ResponseBody } from '../../types'

export default async function postItem(req: Request, res: Response) {
    const reqBody = matchedData(req, { locations: ['body'] })
    const { displayName, prices, icon } = reqBody as PostItemBody
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
