import type { Request, Response } from 'express'
import { supportedScopes } from '@/services/clientService.js'
import {
    createResponseBody,
    type ServiceMetaResponse,
} from '@/lib/responses.js'
import env from '@/lib/env.js'

export default async function getMeta(_req: Request, res: Response) {
    const body = createResponseBody<ServiceMetaResponse>({
        version: env.CURRENT_VERSION,
        supportedScopes,
    })
    res.json(body)
}
