import { Request, Response, NextFunction } from 'express'
import { ApiError, sendError } from '../errors'
import jwt, { JwtPayload } from 'jsonwebtoken'
import env from '../config/env'
import { GroupId, UserId } from 'gammait'
import { isGroupClientJwt, isUserJwt } from '../routes/oauth2/token'
import { Scope } from '../services/clientService'

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

        if (isUserJwt(verifiedToken)) {
        } else if (isGroupClientJwt(verifiedToken)) {
        } else {
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
        complete: true,
    })
    return verifiedToken
}

export function getUserId(res: Response): number | null {
    const jwt = res.locals.jwt
    if (isUserJwt(jwt)) return jwt.user.id
    return null
}

export function getGammaUserId(res: Response): UserId | null {
    const jwt = res.locals.jwt
    if (isUserJwt(jwt)) return jwt.user.gammaId
    return null
}

export function getGroupId(res: Response): number | null {
    const jwt = res.locals.jwt
    if (isUserJwt(jwt)) return jwt.group.id
    if (isGroupClientJwt(jwt)) return jwt.group.id
    return null
}

export function getGammaGroupId(res: Response): GroupId | null {
    const jwt = res.locals.jwt
    if (isUserJwt(jwt)) return jwt.group.gammaId
    if (isGroupClientJwt(jwt)) return jwt.group.gammaId
    return null
}

export function hasScope(res: Response, scope: Scope): boolean {
    const jwt = res.locals.jwt
    if (isUserJwt(jwt)) return true
    if (isGroupClientJwt(jwt)) return jwt.scope.split(' ').includes(scope)
    return false
}
