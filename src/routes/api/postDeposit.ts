import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { unexpectedErrorPleaseReport } from '../../errors'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import {
    CreatedTransactionResponse,
    PostDepositBody,
    ResponseBody,
} from '../../types'

export default async function postDeposit(req: Request, res: Response) {
    const reqBody = matchedData(req, { locations: ['body'] })
    const { userId: createdFor, total, comment } = reqBody as PostDepositBody

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const deposit = await database.createDeposit(
        groupId,
        createdBy,
        createdFor,
        comment,
        total
    )
    const user = await database.getFullUser(createdFor)
    if (!user) {
        throw unexpectedErrorPleaseReport(
            'Failed to get user balance after creating purchase'
        )
    }
    const balance = user.balance
    const body: ResponseBody<CreatedTransactionResponse> = {
        data: { transaction: deposit, balance },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${deposit.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
