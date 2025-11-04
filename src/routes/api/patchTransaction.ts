import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { TransactionFlagsMap } from '../../flags'
import {
    PatchTransactionBody,
    ResponseBody,
    TransactionResponse,
} from '../../types'

export default async function patchTransaction(req: Request, res: Response) {
    const reqParams = matchedData(req, { locations: ['params'] })
    const reqBody = matchedData(req, { locations: ['body'] })
    const transactionId = parseInt(reqParams.id)
    const { removed } = reqBody as PatchTransactionBody

    const flags: Partial<TransactionFlagsMap> = {
        removed: removed,
    }

    // Update transactions table
    const newTransaction = await database.updateTransaction(
        transactionId,
        flags
    )

    const data: TransactionResponse = { transaction: newTransaction }
    const body: ResponseBody<TransactionResponse> = { data }

    res.json(body)
}
