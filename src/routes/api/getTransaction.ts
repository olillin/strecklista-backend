import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { ResponseBody, TransactionResponse } from '../../types'

export default async function getTransaction(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const transactionId = parseInt(req.params.id)
    const transaction = await database.getTransaction(transactionId)
    const body: ResponseBody<TransactionResponse> = { data: { transaction } }
    res.json(body)
}
