import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import {
    PostStockUpdateBody,
    ResponseBody,
    TransactionResponse,
} from '../../types'

export default async function postStockUpdate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { items, comment } = req.body as PostStockUpdateBody

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const stockUpdate = await database.createStockUpdate(
        groupId,
        createdBy,
        comment,
        items
    )
    const body: ResponseBody<TransactionResponse> = {
        data: { transaction: stockUpdate },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${stockUpdate.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
