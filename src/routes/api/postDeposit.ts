import { Request, Response } from 'express'
import { CreatedTransactionResponse, ResponseBody } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { sendError, unexpectedError } from '../../errors'
import { createDeposit } from '../../services/transactionService'
import { getUser } from '../../services/userService'

export interface PostDepositBody {
    userId: number
    total: number
    comment?: string
}

export default async function postDeposit(req: Request, res: Response) {
    const { userId: createdFor, total, comment } = req.body as PostDepositBody

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const deposit = await createDeposit(
        groupId,
        createdBy,
        createdFor,
        comment ?? null,
        total
    )
    const user = await getUser(createdFor, groupId)
    if (!user) {
        sendError(
            res,
            unexpectedError(
                'Failed to get user balance after creating purchase'
            )
        )
        return
    }
    const balance = user.balance
    const body: ResponseBody<CreatedTransactionResponse> = {
        data: { transaction: deposit, balance: balance.toNumber() },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${deposit.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
