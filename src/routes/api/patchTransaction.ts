import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { TransactionFlagsMap } from '../../flags'
import {
    PatchTransactionBody,
    ResponseBody,
    TransactionResponse,
} from '../../types'

export default async function patchTransaction(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const transactionId = parseInt(req.params.id)
    const { removed } = req.body as PatchTransactionBody

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
