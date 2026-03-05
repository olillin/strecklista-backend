import { Request, Response } from 'express'
import { TransactionResponse, ResponseBody } from '../../responses'
import {
    TransactionFlags,
    updateTransaction,
} from '../../services/transactionService'
import { convertDecimalToNumber } from '../../util/decimalToNumber'

export interface PatchTransactionBody {
    removed?: boolean
}

export default async function patchTransaction(req: Request, res: Response) {
    const transactionId = parseInt(req.params.id)
    const { removed } = req.body as PatchTransactionBody

    const flags: Partial<TransactionFlags> = {
        removed: removed,
    }

    // Update transactions table
    const newTransaction = await updateTransaction(transactionId, flags)

    const data: TransactionResponse = {
        transaction: convertDecimalToNumber(newTransaction),
    }
    const body: ResponseBody<TransactionResponse> = { data }

    res.json(body)
}
