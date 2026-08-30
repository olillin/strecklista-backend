import { Router, type Request, type Response } from 'express'
import * as publicRoutes from '@/routes/public/index.js'
import setHeader from '@/middleware/setHeader.js'
import { sendError } from '@/errors.js'
import type { ErrorResolvable } from '@/errors.js'

export default async function createPublicRouter(): Promise<Router> {
    const router = Router()

    type HandlerName = keyof typeof publicRoutes

    /*
     * Routes are defined as: path, handler/error
     */
    const routes: [string, HandlerName | ErrorResolvable][] = [
        ['/meta', 'getMeta'],
    ]

    for (const [path, name] of routes) {
        // Register listener
        const handler =
            typeof name === 'string'
                ? // Normal routes
                  [publicRoutes[name]]
                : // Error routes
                  [
                      (_req: Request, res: Response) => {
                          sendError(res, name as ErrorResolvable)
                      },
                  ]

        router.get(path, setHeader('Allow', ['get']), ...handler)
    }

    return router
}
