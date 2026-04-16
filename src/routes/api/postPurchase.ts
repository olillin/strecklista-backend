import { Request, Response } from 'express'
import { CreatedTransactionResponse, ResponseBody } from '../../responses'
import {
    getGroupId,
    getTransactionCreator,
} from '../../middleware/validateToken'
import { ApiError, sendError, unexpectedError } from '../../errors'
import { createPurchase } from '../../services/transactionService'
import { getOfflineGroupUser } from '../../services/userService'
import { convertDecimalToNumber } from '../../util/decimalToNumber'

export interface JsonPrice {
    price: number
    displayName: string
}

export interface PurchaseItem {
    id: number
    quantity: number
    purchasePrice: JsonPrice
}

export interface PostPurchaseBody {
    userId: number
    items: PurchaseItem[]
    comment?: string
}

export default async function postPurchase(req: Request, res: Response) {
    const { userId: createdFor, items, comment } = req.body as PostPurchaseBody

    const groupId = getGroupId(res)
    const createdBy = getTransactionCreator(res)
    if (groupId == null || createdBy == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const purchase = await createPurchase(
        groupId,
        createdBy,
        createdFor,
        comment ?? null,
        items
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
    const body: ResponseBody<CreatedTransactionResponse> = {
        data: {
            transaction: convertDecimalToNumber(purchase),
            balance: groupUser.balance.toNumber(),
        },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${purchase.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
