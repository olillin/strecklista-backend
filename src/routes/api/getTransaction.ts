import type { Request, Response } from 'express'
import type { ResponseBody, TransactionResponse } from '@/responses.js'
import * as transactionService from '@/services/transactionService.js'
import { convertDecimalToNumber } from '@/util/decimalToNumber.js'

export default async function getTransaction(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const transactionId = parseInt(req.params.id)
    const transaction = await transactionService.getTransaction(transactionId)
    const body: ResponseBody<TransactionResponse> = {
        data: { transaction: convertDecimalToNumber(transaction) },
    }
    res.json(body)
}
