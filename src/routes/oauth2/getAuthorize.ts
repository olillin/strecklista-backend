import { authorizationCode } from '@/lib/gamma.js'
import type { Request, Response } from 'express'

export default async function routeHandler(
    _req: Request,
    res: Response
): Promise<void> {
    res.redirect(authorizationCode.authorizeUrl())
}
