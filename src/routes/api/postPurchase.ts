import { NextFunction, Request, Response } from 'express'
import { database } from '../../config/clients'
import { unexpectedErrorPleaseReport } from '../../errors'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import {
    CreatedTransactionResponse,
    PostPurchaseBody,
    ResponseBody,
} from '../../types'

export default async function postPurchase(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { userId: createdFor, items, comment } = req.body as PostPurchaseBody

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const purchase = await database.createPurchase(
        groupId,
        createdBy,
        createdFor,
        comment,
        items
    )
    const user = await database.getFullUser(createdFor)
    if (!user) {
        return next(
            unexpectedErrorPleaseReport(
                'Failed to get user balance after creating purchase'
            )
        )
    }
    const balance = user.balance
    const body: ResponseBody<CreatedTransactionResponse> = {
        data: { transaction: purchase, balance },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${purchase.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
