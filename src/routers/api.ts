import { NextFunction, Request, Response, Router } from 'express'
import { ApiError } from "../errors"
import setHeader from "../middleware/setHeader"
import validateToken from '../middleware/validateToken'
import validationErrorHandler from '../middleware/validationErrorHandler'
import * as validators from '../middleware/validators'
import * as apiRoutes from '../routes/api'
import { ErrorResolvable } from "../types"

async function createApiRouter(): Promise<Router> {
    const api = Router()

    api.use(validateToken)

    type Method =
        | 'all'
        | 'get'
        | 'post'
        | 'put'
        | 'delete'
        | 'patch'
        | 'options'
        | 'head'
    type HandlerName = keyof typeof validators & keyof typeof apiRoutes

    /*
     * Routes are defined as: method, path, handler/error
     */
    const routes: [Method, string, HandlerName | ErrorResolvable, boolean?][] = [
        ['get', '/user', 'getUser'],
        ['get', '/group', 'getGroup'],
        ['get', '/group/transaction', 'getTransactions'],
        ['get', '/group/transaction/:id', 'getTransaction'],
        ['patch', '/group/transaction/:id', 'patchTransaction'],
        ['delete', '/group/transaction/:id', ApiError.CannotDeleteTransaction],
        ['post', '/group/purchase', 'postPurchase'],
        ['post', '/group/deposit', 'postDeposit'],
        ['post', '/group/stock', 'postStockUpdate'],
        ['get', '/group/item', 'getItems'],
        ['get', '/group/item/:id', 'getItem'],
        ['post', '/group/item', 'postItem'],
        ['patch', '/group/item/:id', 'patchItem'],
        ['delete', '/group/item/:id', 'deleteItem'],
    ]

    for (const [method, path, name] of routes) {
        // Get allowed methods on this path
        const methods: Set<string> = new Set(
            routes
                .filter(other => other[1] === path && typeof other[2] === 'string')
                .map(other => other[0].toUpperCase())
        )
        // Register listener
        const handler = typeof name === 'string'
            // Normal routes
            ? [
                ...validators[name](),
                validationErrorHandler,
                apiRoutes[name]
            ]
            // Error routes
            : [
                (req: Request, res: Response, next: NextFunction) => {
                    return next(name)
                }
            ]

        api[method](
            path,
            setHeader('Allow', methods),
            ...handler,
        )
    }

    return api
}
export default createApiRouter
