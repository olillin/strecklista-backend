import { Request, Response } from 'express'
import { ResponseBody, TransactionResponse } from '../../responses'
import * as transactionService from '../../services/transactionService'
import { convertToJson } from '../../util/convertToJson'

export default async function getTransaction(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const transactionId = parseInt(req.params.id)
    const transaction = await transactionService.getTransaction(transactionId)
    const body: ResponseBody<TransactionResponse> = {
        data: { transaction: convertToJson(transaction) },
    }
    res.json(body)
}
