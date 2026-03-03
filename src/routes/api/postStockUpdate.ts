import { Request, Response } from 'express'
import { ResponseBody, TransactionResponse } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { createStockUpdate } from '../../services/transactionService'

export interface PostStockUpdateBody {
    items: PostItemStockUpdate[]
    comment?: string
}

export interface PostItemStockUpdate {
    id: number
    quantity: number
    absolute?: boolean
}

export default async function postStockUpdate(req: Request, res: Response) {
    const { items, comment } = req.body as PostStockUpdateBody

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const stockUpdate = await createStockUpdate(
        groupId,
        createdBy,
        comment ?? null,
        items
    )
    const body: ResponseBody<TransactionResponse> = {
        data: { transaction: stockUpdate },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${stockUpdate.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
