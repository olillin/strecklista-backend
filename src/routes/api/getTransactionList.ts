import type { Request, Response } from 'express'
import { getGroupId } from '@/lib/token.js'
import {
    createResponseBody,
    type TransactionListResponse,
} from '@/lib/responses.js'
import * as transactionService from '@/services/transactionService.js'
import { ApiError, sendError } from '@/lib/errors.js'
import { isClientId } from '@/services/clientService.js'

export const DEFAULT_LIMIT = 50
export const DEFAULT_OFFSET = 0

export default async function routeHandler(req: Request, res: Response) {
    const limit =
        typeof req.query.limit === 'string'
            ? parseInt(req.query.limit)
            : DEFAULT_LIMIT
    const offset =
        typeof req.query.offset === 'string'
            ? parseInt(req.query.offset)
            : DEFAULT_OFFSET

    const createdFor =
        typeof req.query.createdFor === 'string'
            ? parseInt(req.query.createdFor)
            : undefined
    const createdById =
        typeof req.query.createdBy === 'string'
            ? req.query.createdBy
            : undefined

    let createdBy: transactionService.TransactionCreator | undefined = undefined
    if (createdById != undefined) {
        if (isClientId(createdById)) {
            createdBy = {
                clientId: createdById,
            }
        } else {
            createdBy = {
                userId: parseInt(createdById),
            }
        }
    }

    const groupId = getGroupId(res)
    if (groupId == null) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const options: transactionService.TransactionFilterOptions = {
        createdFor,
        createdBy,
    }

    const count = await transactionService.countTransactionsInGroup(
        groupId,
        options
    )
    const transactions = await transactionService.getTransactionsInGroup(
        groupId,
        limit,
        offset,
        options
    )

    let previousOffset = offset - limit
    const clamped = previousOffset < 0
    if (clamped) previousOffset = 0

    const optionsParams = new URLSearchParams()
    if (options.createdFor) {
        optionsParams.append('createdFor', options.createdFor.toString())
    }
    if (options.createdBy) {
        optionsParams.append(
            'createdBy',
            options.createdBy.clientId ?? options.createdBy.userId.toString()
        )
    }

    const optionsParamsString =
        optionsParams.size === 0 ? '' : '&' + optionsParams.toString()

    const previousUrl =
        req.baseUrl +
        `/group/transaction?offset=${previousOffset}&limit=${clamped ? offset : limit}${optionsParamsString}`
    const nextUrl =
        req.baseUrl +
        `/group/transaction?offset=${offset + limit}&limit=${limit}${optionsParamsString}`

    const body = createResponseBody<TransactionListResponse>({
        transactions,
        count,
        ...(offset > 0 && { previous: previousUrl }),
        ...(count > offset + limit && { next: nextUrl }),
    })
    res.json(body)
}
