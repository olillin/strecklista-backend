import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { ResponseBody, TransactionResponse } from '../../types'

export default async function getTransaction(req: Request, res: Response) {
    const requestParams = matchedData(req, { locations: ['params'] })
    const transactionId = parseInt(requestParams.id)
    const transaction = await database.getTransaction(transactionId)
    const body: ResponseBody<TransactionResponse> = { data: { transaction } }
    res.json(body)
}
