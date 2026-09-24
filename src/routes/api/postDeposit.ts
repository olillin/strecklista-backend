import type { Request, Response } from 'express'
import {
    createResponseBody,
    type CreatedTransactionResponse,
} from '@/lib/responses.js'
import { getGroupId, getTransactionCreator } from '@/lib/token.js'
import { ApiError, sendError, unexpectedError } from '@/lib/errors.js'
import { createDeposit } from '@/services/transactionService.js'
import { getOfflineGroupUser } from '@/services/userService.js'

export interface PostDepositBody {
    userId: number
    total: number
    comment?: string
}

export default async function routeHandler(req: Request, res: Response) {
    const { userId: createdFor, total, comment } = req.body as PostDepositBody

    const groupId = getGroupId(res)
    const createdBy = getTransactionCreator(res)
    if (groupId == null || createdBy == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const deposit = await createDeposit(
        groupId,
        createdBy,
        createdFor,
        comment ?? null,
        total
    )
    const groupUser = await getOfflineGroupUser(createdFor, groupId)
    if (!groupUser) {
        sendError(
            res,
            unexpectedError(
                'Failed to get user balance after creating purchase'
            )
        )
        return
    }
    const body = createResponseBody<CreatedTransactionResponse>({
        transaction: deposit,
        balance: groupUser.balance.toNumber(),
    })

    const resourceUri = req.baseUrl + `/group/transaction/${deposit.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
