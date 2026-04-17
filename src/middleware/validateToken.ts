import type { Request, Response, NextFunction } from 'express'
import { ApiError, sendError } from '@/errors.js'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import env from '@/config/env.js'
import * as gamma from 'gammait'
import { isGroupClientJwt, isUserJwt } from '@/routes/oauth2/token.js'
import type { Scope } from '@/services/clientService.js'
import {
    createTransactionCreator,
    type TransactionCreator,
} from '@/services/transactionService.js'

function validateToken(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} to API: ${req.path}`)

    const auth = req.headers.authorization
    if (!auth) {
        sendError(res, ApiError.Unauthorized)
        return
    }

    const [tokenType, token] = auth.split(' ')
    if (tokenType !== 'Bearer') {
        sendError(res, ApiError.Unauthorized)
        return
    }

    try {
        const verifiedToken = verifyToken(token)

        if (verifiedToken.exp) {
            const isExpired = Date.now() >= verifiedToken.exp * 1000
            if (isExpired) {
                sendError(res, ApiError.ExpiredToken)
                return
            }
        }
        if (verifiedToken.nbf) {
            const isBefore = Date.now() < verifiedToken.nbf * 1000
            if (isBefore) {
                sendError(res, ApiError.BeforeNbf)
                return
            }
        }

        if (!isUserJwt(verifiedToken) && !isGroupClientJwt(verifiedToken)) {
            sendError(res, ApiError.InvalidToken)
            return
        }

        // Store token
        res.locals.jwt = verifiedToken
        next()
    } catch {
        sendError(res, ApiError.Unauthorized)
    }
}
export default validateToken

export function verifyToken(token: string): JwtPayload {
    const verifiedToken = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: env.JWT_ISSUER,
    })
    if (typeof verifiedToken === 'string') {
        throw new Error('Failed to verify token, got string payload')
    }
    return verifiedToken
}

export function getUserId(res: Response): number | null
export function getUserId(jwt: JwtPayload): number | null
export function getUserId(resOrJwt: Response | JwtPayload): number | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.user.id
    return null
}

export function getGammaUserId(res: Response): gamma.UserId | null
export function getGammaUserId(jwt: JwtPayload): gamma.UserId | null
export function getGammaUserId(
    resOrJwt: Response | JwtPayload
): gamma.UserId | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.user.gammaId
    return null
}

export function getGroupId(res: Response): number | null
export function getGroupId(jwt: JwtPayload): number | null
export function getGroupId(resOrJwt: Response | JwtPayload): number | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.group.id
    if (isGroupClientJwt(jwt)) return jwt.group.id
    return null
}

export function getGammaGroupId(res: Response): gamma.GroupId | null
export function getGammaGroupId(jwt: JwtPayload): gamma.GroupId | null
export function getGammaGroupId(
    resOrJwt: Response | JwtPayload
): gamma.GroupId | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.group.gammaId
    if (isGroupClientJwt(jwt)) return jwt.group.gammaId
    return null
}

export function getClientId(res: Response): string | null
export function getClientId(jwt: JwtPayload): string | null
export function getClientId(resOrJwt: Response | JwtPayload): string | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isGroupClientJwt(jwt)) return jwt.client.id
    return null
}

export function hasScope(res: Response, scope: Scope): boolean
export function hasScope(jwt: JwtPayload, scope: Scope): boolean
export function hasScope(
    resOrJwt: Response | JwtPayload,
    scope: Scope
): boolean {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return true
    if (isGroupClientJwt(jwt)) return jwt.scope.split(' ').includes(scope)
    return false
}

export function getTransactionCreator(
    res: Response
): TransactionCreator | null {
    const userId = getUserId(res)
    const clientId = getClientId(res)
    return createTransactionCreator(userId, clientId)
}
