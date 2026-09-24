import jwt, { type JwtPayload } from 'jsonwebtoken'
import gamma from 'gammait'
import env from '@/lib/env.js'
import { ulid } from 'ulid'
import type { Scope } from '@/services/clientService.js'
import type { Response } from 'express'
import {
    createTransactionCreator,
    type TransactionCreator,
} from '@/services/transactionService.js'

export const acceptedGrantTypes = [
    'authorization_code',
    'client_credentials',
] as const
export type GrantType = (typeof acceptedGrantTypes)[number]

export interface JwtWithToken extends jwt.JwtPayload {
    access_token: string
    token_type: 'Bearer'
}

export interface UserJwt {
    user: {
        id: number
        gammaId: gamma.UserId
    }
    group: {
        id: number
        gammaId: gamma.GroupId
    }
}

export interface GroupClientJwt {
    client: {
        id: string
        displayName: string
    }
    group: {
        id: number
        gammaId: gamma.GroupId
    }
    scope: string
}

export interface ClientCredentials {
    clientId: string
    clientSecret: string
}

export function isUserJwt(value: unknown): value is UserJwt {
    if (typeof value !== 'object' || value === null) return false

    const obj = value as Record<string, unknown>

    const user = obj.user
    if (typeof user !== 'object' || user === null) return false

    const userObj = user as Record<string, unknown>
    if (typeof userObj.id !== 'number') return false
    if (typeof userObj.gammaId !== 'string') return false

    const group = obj.group
    if (typeof group !== 'object' || group === null) return false

    const groupObj = group as Record<string, unknown>
    return (
        typeof groupObj.id === 'number' && typeof groupObj.gammaId === 'string'
    )
}

export function isGroupClientJwt(value: unknown): value is GroupClientJwt {
    if (typeof value !== 'object' || value === null) return false

    const obj = value as Record<string, unknown>
    if (typeof obj.scope !== 'string') return false

    const client = obj.client
    if (typeof client !== 'object' || client === null) return false

    const clientObj = client as Record<string, unknown>
    if (typeof clientObj.id !== 'string') return false
    if (typeof clientObj.displayName !== 'string') return false

    const group = obj.group
    if (typeof group !== 'object' || group === null) return false

    const groupObj = group as Record<string, unknown>
    return (
        typeof groupObj.id === 'number' && typeof groupObj.gammaId === 'string'
    )
}

export function signUserJwt(content: UserJwt): Promise<JwtWithToken> {
    return new Promise((resolve, reject) => {
        const expireSeconds = parseInt(env.JWT_EXPIRES_IN)

        try {
            jwt.sign(
                content,
                env.JWT_SECRET,
                {
                    issuer: env.JWT_ISSUER,
                    subject: String(content.user.id),
                    algorithm: 'HS256',
                    expiresIn: expireSeconds,
                    notBefore: 0,
                    jwtid: ulid(),
                } satisfies jwt.SignOptions,
                (error, token) => {
                    if (error) reject(error)
                    else if (token) {
                        const token_content = jwt.decode(token, {
                            json: true,
                        })!
                        resolve({
                            access_token: token,
                            token_type: 'Bearer',
                            ...token_content,
                        })
                    }
                }
            )
        } catch (error) {
            reject(error)
        }
    })
}

export function signGroupClientJwt(
    content: GroupClientJwt
): Promise<JwtWithToken> {
    return new Promise((resolve, reject) => {
        const expireSeconds = parseInt(env.JWT_EXPIRES_IN)

        try {
            jwt.sign(
                {
                    client: {
                        id: content.client.id,
                        displayName: content.client.displayName,
                    },
                    group: content.group,
                    scope: content.scope,
                } satisfies GroupClientJwt,
                env.JWT_SECRET,
                {
                    issuer: env.JWT_ISSUER,
                    audience: content.client.id,
                    algorithm: 'HS256',
                    expiresIn: expireSeconds,
                    notBefore: 0,
                    jwtid: ulid(),
                } satisfies jwt.SignOptions,
                (error, token) => {
                    if (error) reject(error)
                    else if (token) {
                        const token_content = jwt.decode(token, {
                            json: true,
                        })!
                        resolve({
                            access_token: token,
                            token_type: 'Bearer',
                            ...token_content,
                        })
                    }
                }
            )
        } catch (error) {
            reject(error)
        }
    })
}

export function verifyToken(token: string): jwt.JwtPayload {
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
export function getUserId(jwt: jwt.JwtPayload): number | null
export function getUserId(resOrJwt: Response | jwt.JwtPayload): number | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.user.id
    return null
}

export function getGammaUserId(res: Response): gamma.UserId | null
export function getGammaUserId(jwt: jwt.JwtPayload): gamma.UserId | null
export function getGammaUserId(
    resOrJwt: Response | jwt.JwtPayload
): gamma.UserId | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.user.gammaId
    return null
}

export function getGroupId(res: Response): number | null
export function getGroupId(jwt: jwt.JwtPayload): number | null
export function getGroupId(resOrJwt: Response | jwt.JwtPayload): number | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.group.id
    if (isGroupClientJwt(jwt)) return jwt.group.id
    return null
}

export function getGammaGroupId(res: Response): gamma.GroupId | null
export function getGammaGroupId(jwt: jwt.JwtPayload): gamma.GroupId | null
export function getGammaGroupId(
    resOrJwt: Response | jwt.JwtPayload
): gamma.GroupId | null {
    const jwt: unknown = Object.hasOwn(resOrJwt, 'locals')
        ? resOrJwt.locals.jwt
        : resOrJwt
    if (isUserJwt(jwt)) return jwt.group.gammaId
    if (isGroupClientJwt(jwt)) return jwt.group.gammaId
    return null
}

export function getClientId(res: Response): string | null
export function getClientId(jwt: jwt.JwtPayload): string | null
export function getClientId(
    resOrJwt: Response | jwt.JwtPayload
): string | null {
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
