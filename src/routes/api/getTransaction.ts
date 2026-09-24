import type { Request, Response } from 'express'
import {
    createResponseBody,
    type TransactionResponse,
} from '@/lib/responses.js'
import * as transactionService from '@/services/transactionService.js'

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const transactionId = parseInt(req.params.id)
    const transaction = await transactionService.getTransaction(transactionId)
    const body = createResponseBody<TransactionResponse>({ transaction })
    res.json(body)
}
