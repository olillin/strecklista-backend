import { Request, Response } from 'express'
import { database } from '../../config/clients'
import { getGroupId } from '../../middleware/validateToken'
import { ResponseBody, TransactionsResponse } from '../../types'

export default async function getTransactions(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string)
    const offset = parseInt(req.query.offset as string)

    const groupId: number = getGroupId(res)

    const count = await database.countTransactionsInGroup(groupId)

    const transactions = await database.getTransactionsInGroup(
        groupId,
        limit,
        offset
    )

    let previousOffset = offset - limit
    const clamped = previousOffset < 0
    if (clamped) previousOffset = 0
    const previousUrl =
        req.baseUrl +
        `/group/transaction?offset=${previousOffset}&limit=${
            clamped ? offset : limit
        }`
    const nextUrl =
        req.baseUrl +
        `/group/transaction?offset=${offset + limit}&limit=${limit}`

    const body: ResponseBody<TransactionsResponse> = {
        data: {
            transactions,
            ...(offset > 0 && { previous: previousUrl }),
            ...(count > offset + limit && { next: nextUrl }),
        },
    }
    res.json(body)
}
