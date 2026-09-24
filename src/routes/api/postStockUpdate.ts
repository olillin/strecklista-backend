import type { Request, Response } from 'express'
import {
    createResponseBody,
    type TransactionResponse,
} from '@/lib/responses.js'
import { getGroupId, getTransactionCreator } from '@/lib/token.js'
import { createStockUpdate } from '@/services/transactionService.js'
import { ApiError, sendError } from '@/lib/errors.js'

export interface PostStockUpdateBody {
    items: PostItemStockUpdate[]
    comment?: string
}

export interface PostItemStockUpdate {
    id: number
    quantity: number
    absolute?: boolean
}

export default async function routeHandler(req: Request, res: Response) {
    const { items, comment } = req.body as PostStockUpdateBody

    const groupId = getGroupId(res)
    const createdBy = getTransactionCreator(res)
    if (groupId == null || createdBy == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const stockUpdate = await createStockUpdate(
        groupId,
        createdBy,
        comment ?? null,
        items
    )
    const body = createResponseBody<TransactionResponse>({
        transaction: stockUpdate,
    })
    const resourceUri = req.baseUrl + `/group/transaction/${stockUpdate.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
