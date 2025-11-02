import { Request, Response } from 'express'
import { database } from '../../config/clients'
import { LegalItemColumn } from '../../database/client'
import { ItemFlagsMap } from '../../flags'
import { getUserId } from '../../middleware/validateToken'
import { ItemResponse, PatchItemBody, ResponseBody } from '../../types'

export default async function patchItem(req: Request, res: Response) {
    const userId: number = getUserId(res)

    const itemId = parseInt(req.params.id)
    const { icon, displayName, visible, favorite, prices } =
        req.body as PatchItemBody

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
