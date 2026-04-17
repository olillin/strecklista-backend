import { Router, type Request, type Response, type NextFunction } from 'express'
import validateToken, { hasScope } from '@/middleware/validateToken.js'
import validationErrorHandler from '@/middleware/validationErrorHandler.js'
import * as validators from '@/middleware/validators.js'
import * as apiRoutes from '@/routes/api/index.js'
import setHeader from '@/middleware/setHeader.js'
import { ApiError, sendError } from '@/errors.js'
import type { ErrorResolvable } from '@/errors.js'
import type { Scope } from '@/services/clientService.js'
import { isGroupClientJwt, isUserJwt } from '@/routes/oauth2/token.js'

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
     * Routes are defined as: method, path, handler/error, required client scopes
     */
    const routes: [Method, string, HandlerName | ErrorResolvable, Scope?][] = [
        ['get', '/user', 'getUser'],
        ['get', '/group', 'getGroup', 'group.read'],
        ['get', '/group/transaction', 'getTransactions', 'transactions.read'],
        [
            'get',
            '/group/transaction/:id',
            'getTransaction',
            'transactions.read',
        ],
        [
            'patch',
            '/group/transaction/:id',
            'patchTransaction',
            'transactions.update',
        ],
        ['delete', '/group/transaction/:id', ApiError.CannotDeleteTransaction],
        ['post', '/group/purchase', 'postPurchase', 'transactions.create'],
        ['post', '/group/deposit', 'postDeposit', 'transactions.create'],
        ['post', '/group/stock', 'postStockUpdate', 'transactions.create'],
        ['get', '/group/item', 'getItems', 'items.read'],
        ['get', '/group/item/:id', 'getItem', 'items.read'],
        ['post', '/group/item', 'postItem', 'items.create'],
        ['patch', '/group/item/:id', 'patchItem', 'items.update'],
        ['delete', '/group/item/:id', 'deleteItem', 'items.delete'],
        ['get', '/group/client/:id', 'getGroupClient'],
        ['post', '/group/client', 'postGroupClient'],
        // ['post', '/group/client/:id', 'updateClient'],
        // ['delete', '/group/client/:id', 'deleteClient'],
    ]

    for (const [method, path, name, scope] of routes) {
        // Get allowed methods on this path
        const methods: Set<string> = new Set(
            routes
                .filter(
                    other => other[1] === path && typeof other[2] === 'string'
                )
                .map(other => other[0].toUpperCase())
        )
        // Register listener
        const handler =
            typeof name === 'string'
                ? // Normal routes
                  [
                      validateScope(scope),
                      ...validators[name](),
                      validationErrorHandler,
                      apiRoutes[name],
                  ]
                : // Error routes
                  [
                      (_req: Request, res: Response) => {
                          sendError(res, name as ErrorResolvable)
                      },
                  ]

        api[method](path, setHeader('Allow', methods), ...handler)
    }

    return api
}
export default createApiRouter

function validateScope(scope: Scope | undefined) {
    return (_req: Request, res: Response, next: NextFunction) => {
        const jwt: unknown = res.locals.jwt

        // Do not check scopes for users
        if (isUserJwt(jwt)) {
            next()
            return
        }

        if (!isGroupClientJwt(jwt)) {
            sendError(res, ApiError.InvalidToken)
            return
        }

        // Do not allow clients to access routes without scopes
        if (scope == undefined) {
            sendError(res, ApiError.Forbidden)
            return
        }

        // Check if client has the permitted scope
        if (hasScope(res, scope)) {
            next()
            return
        }

        sendError(res, ApiError.InsufficientScope)
    }
}
