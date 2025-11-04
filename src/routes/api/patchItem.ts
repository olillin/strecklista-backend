import { Request, Response } from 'express'
import { matchedData } from 'express-validator'
import { database } from '../../config/clients'
import { LegalItemColumn } from '../../database/client'
import { ItemFlagsMap } from '../../flags'
import { getUserId } from '../../middleware/validateToken'
import { ItemResponse, PatchItemBody, ResponseBody } from '../../types'

export default async function patchItem(req: Request, res: Response) {
    const reqParams = matchedData(req, { locations: ['params'] })
    const reqBody = matchedData(req, { locations: ['body'] })
    const itemId = parseInt(reqParams.id)
    const { icon, displayName, visible, favorite, prices } =
        reqBody as PatchItemBody

    const userId: number = getUserId(res)

    const flags: Partial<ItemFlagsMap> = {
        invisible: visible === undefined ? undefined : !visible,
    }

    // Update Items table
    const columns: (LegalItemColumn | undefined)[] = [
        'icon_url',
        'display_name',
        'favorite',
    ]
    const values = [icon, displayName, favorite]
    for (let i = 0; i < values.length; i++) {
        if (values[i] === undefined) columns[i] = undefined
    }

    const newItem = await database.updateItem(
        itemId,
        userId,
        columns.filter(x => x !== undefined),
        values.filter(x => x !== undefined),
        flags,
        prices
    )

    const data: ItemResponse = { item: newItem }
    const body: ResponseBody<ItemResponse> = { data }

    res.json(body)
}
