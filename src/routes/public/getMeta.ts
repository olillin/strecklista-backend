import type { Request, Response } from 'express'
import { supportedScopes } from '@/services/clientService.js'
import type { ResponseBody, ServiceMetaResponse } from '@/responses.js'
import env from '@/config/env.js'

export default async function getMeta(_req: Request, res: Response) {
    const body: ResponseBody<ServiceMetaResponse> = {
        data: {
            version: env.CURRENT_VERSION,
            supportedScopes,
        },
    }

    res.json(body)
}
