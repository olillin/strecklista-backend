import { Request, Response } from 'express'
import { ResponseBody, TransactionResponse } from '../../responses'
import * as transactionService from '../../services/transactionService'
import { convertDecimalToNumber } from '../../util/decimalToNumber'

export default async function getTransaction(req: Request, res: Response) {
    const transactionId = parseInt(req.params.id)
    const transaction = await transactionService.getTransaction(transactionId)
    const body: ResponseBody<TransactionResponse> = {
        data: { transaction: convertDecimalToNumber(transaction) },
    }
    res.json(body)
}
