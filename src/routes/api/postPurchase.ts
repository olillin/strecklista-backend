import { Request, Response } from 'express'
import { CreatedTransactionResponse, ResponseBody } from '../../responses'
import { getGroupId, getUserId } from '../../middleware/validateToken'
import { sendError, unexpectedError } from '../../errors'
import { createPurchase } from '../../services/transactionService'
import { getUser } from '../../services/userService'
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

    const groupId: number = getGroupId(res)
    const createdBy: number = getUserId(res)

    const purchase = await createPurchase(
        groupId,
        createdBy,
        createdFor,
        comment ?? null,
        items
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
        data: {
            transaction: convertDecimalToNumber(purchase),
            balance: balance.toNumber(),
        },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${purchase.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
