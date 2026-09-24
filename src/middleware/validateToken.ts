import type { Request, Response, NextFunction } from 'express'
import { ApiError, sendError } from '@/lib/errors.js'
import { isGroupClientJwt, isUserJwt, verifyToken } from '@/lib/token.js'

export default function validateToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
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
