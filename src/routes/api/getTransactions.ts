import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { getGroupId } from '../../middleware/validateToken'
import { ResponseBody, TransactionsResponse } from '../../types'

export default async function getTransactions(req: Request, res: Response) {
    const reqQuery = matchedData(req, { locations: ['query'] })
    const limit = parseInt(reqQuery.limit as string)
    const offset = parseInt(reqQuery.offset as string)

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
