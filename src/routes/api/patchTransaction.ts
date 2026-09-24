import type { Request, Response } from 'express'
import {
    type TransactionResponse,
    createResponseBody,
} from '@/lib/responses.js'
import {
    type TransactionPatch,
    updateTransaction,
} from '@/services/transactionService.js'

export interface PatchTransactionBody {
    removed?: boolean
}

export default async function routeHandler(req: Request, res: Response) {
    if (typeof req.params.id !== 'string') {
        throw new Error('Invalid id, expected string but got array')
    }
    const transactionId = parseInt(req.params.id)
    const { removed } = req.body as PatchTransactionBody

    const patch: TransactionPatch = {
        removed,
    }

    // Update transactions table
    const newTransaction = await updateTransaction(transactionId, patch)

    const body = createResponseBody<TransactionResponse>({
        transaction: newTransaction,
    })
    res.json(body)
}
