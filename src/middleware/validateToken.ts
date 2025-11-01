import { NextFunction, Request, Response } from 'express'
import { GroupId, UserId } from 'gammait'
import jwt from 'jsonwebtoken'
import env from '../config/env'
import { ApiError } from '../errors'
import { LocalJwt } from '../types'

function validateToken(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} to API: ${req.path}`)

    const auth = req.headers.authorization
    if (!auth) {
        return next(ApiError.Unauthorized)
    }
    const token = auth.split(' ')[1]
    try {
        const verifiedToken = verifyToken(token)

        if (verifiedToken.exp) {
            const isExpired = Date.now() >= verifiedToken.exp * 1000
            if (isExpired) {
                return next(ApiError.ExpiredToken)
            }
        }
        if (verifiedToken.nbf) {
            const isBefore = Date.now() < verifiedToken.nbf * 1000
            if (isBefore) {
                return next(ApiError.BeforeNbf)
            }
        }

        if (!verifiedToken.userId || !verifiedToken.groupId) {
            return next(ApiError.InvalidToken)
        }

        console.log('Verified token:')
        console.log(verifiedToken)

        // Store token
        res.locals.jwt = verifiedToken
        next()
    } catch {
        next(ApiError.Unauthorized)
    }
}
export default validateToken

export function verifyToken(token: string): LocalJwt {
    return jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: env.JWT_ISSUER,
    }) as LocalJwt
}

export function getUserId(res: Response): number {
    const jwt: LocalJwt = res.locals.jwt
    return jwt.userId
}

export function getGammaUserId(res: Response): UserId {
    const jwt: LocalJwt = res.locals.jwt
    return jwt.gammaUserId
}

export function getGroupId(res: Response): number {
    const jwt: LocalJwt = res.locals.jwt
    return jwt.groupId
}

export function getGammaGroupId(res: Response): GroupId {
    const jwt: LocalJwt = res.locals.jwt
    return jwt.gammaGroupId
}
