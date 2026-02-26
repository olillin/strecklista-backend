import { Request, Response, NextFunction } from 'express'
import { ApiError, sendError } from '../errors'
import jwt, { JwtPayload } from 'jsonwebtoken'
import env from '../config/env'
import { GroupId, UserId } from 'gammait'
import { isLoggedInUser, LoggedInUser } from '../routes/login'

export type LocalJwt = JwtPayload & LoggedInUser

export function isLocalJwt(value: unknown): value is LocalJwt {
    if (!isLoggedInUser(value)) {
        return false
    }

    const obj = value as object as Record<string, unknown>

    return typeof obj.iss === 'string' && typeof obj.exp === 'number'
}

function validateToken(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} to API: ${req.path}`)

    const auth = req.headers.authorization
    if (!auth) {
        sendError(res, ApiError.Unauthorized)
        return
    }
    const token = auth.split(' ')[1]
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

        if (!verifiedToken.userId || !verifiedToken.groupId) {
            sendError(res, ApiError.InvalidToken)
            return
        }

        console.log('Verified token:')
        console.log(verifiedToken)

        // Store token
        res.locals.jwt = verifiedToken
        next()
    } catch {
        sendError(res, ApiError.Unauthorized)
    }
}
export default validateToken

export function verifyToken(token: string): LocalJwt {
    const verifiedToken = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: env.JWT_ISSUER,
    })
    if (!isLocalJwt(verifiedToken)) {
        throw new Error('Verified token has invalid shape')
    }
    return verifiedToken
}

export function getUserId(res: Response): number {
    const jwt = res.locals.jwt
    if (!isLocalJwt(jwt)) {
        throw new Error('Token has invalid shape')
    }
    return jwt.userId
}

export function getGammaUserId(res: Response): UserId {
    const jwt = res.locals.jwt
    if (!isLocalJwt(jwt)) {
        throw new Error('Token has invalid shape')
    }
    return jwt.gammaUserId
}

export function getGroupId(res: Response): number {
    const jwt = res.locals.jwt
    if (!isLocalJwt(jwt)) {
        throw new Error('Token has invalid shape')
    }
    return jwt.groupId
}

export function getGammaGroupId(res: Response): GroupId {
    const jwt = res.locals.jwt
    if (!isLocalJwt(jwt)) {
        throw new Error('Token has invalid shape')
    }
    return jwt.gammaGroupId
}
