import type { Request, Response } from 'express'
import type { CreatedTransactionResponse, ResponseBody } from '@/responses.js'
import {
    getGroupId,
    getTransactionCreator,
} from '@/middleware/validateToken.js'
import { ApiError, sendError, unexpectedError } from '@/errors.js'
import { createPurchase } from '@/services/transactionService.js'
import {
    findUserByExternalId,
    getOfflineGroupUser,
} from '@/services/userService.js'
import { convertToJson } from '@/util/convertToJson.js'

export interface JsonPrice {
    price: number
    displayName: string
    externalId?: string
}

export interface PurchaseItem {
    id: number
    quantity: number
    purchasePrice: JsonPrice
}

export interface PurchaseExternalItem {
    externalId: string
    quantity: number
}

export function isPurchaseExternalItem(
    item: PurchaseItem | PurchaseExternalItem
): item is PurchaseExternalItem {
    return item.hasOwnProperty('externalId')
}

export type PostPurchaseBody = (
    | {
          userId: number
          externalUserId: undefined
      }
    | {
          userId: undefined
          externalUserId: string
      }
) & {
    items: PurchaseItem[] | PurchaseExternalItem[]
    comment?: string
}

export default async function postPurchase(req: Request, res: Response) {
    const { userId, externalUserId, items, comment } =
        req.body as PostPurchaseBody

    const groupId = getGroupId(res)
    const createdBy = getTransactionCreator(res)
    if (groupId == null || createdBy == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    // Resolve user ID from external ID
    const createdFor =
        userId ?? (await findUserByExternalId(externalUserId, groupId))
    if (createdFor == null) {
        sendError(res, ApiError.UserNotExist)
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
            transaction: convertToJson(purchase),
            balance: groupUser.balance.toNumber(),
        },
    }

    const resourceUri = req.baseUrl + `/group/transaction/${purchase.id}`
    res.status(201).set('Location', resourceUri).json(body)
}
