import type { Request, RequestHandler, Response } from 'express'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import env from '@/config/env.js'
import {
    ApiError,
    missingRequiredPropertyError,
    sendError,
    tokenSignError,
    unexpectedError,
    type ErrorResolvable,
} from '@/errors.js'
import {
    checkClientSecret,
    getGroupClientDetailsWithSecretHash,
} from '@/services/clientService.js'
import { ulid } from 'ulid'
import * as gamma from 'gammait'
import { authorizationCode, clientApi } from '@/config/gamma.js'
import { getAuthorizedGroup } from '@/util/helpers.js'
import {
    type OfflineGroupUser,
    softAddGroupUser,
} from '@/services/userService.js'
import { completeGroupUser, type GroupUser } from '@/services/gammaService.js'
import { toLoginResponse } from '@/responses.js'
import { fromBase64 } from '@exodus/bytes/base64.js'

export const acceptedGrantTypes = [
    'authorization_code',
    'client_credentials',
] as const
export type GrantType = (typeof acceptedGrantTypes)[number]

export interface JwtWithToken extends JwtPayload {
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

function signUserJwt(content: UserJwt): Promise<JwtWithToken> {
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
                } satisfies SignOptions,
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

function signGroupClientJwt(content: GroupClientJwt): Promise<JwtWithToken> {
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
                } satisfies SignOptions,
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

export function tokenRoute(): RequestHandler {
    return async (req: Request, res: Response) => {
        res.setHeader('Allow', 'POST')

        const grantType = req.body['grant_type'] as GrantType
        if (grantType === 'authorization_code') {
            authorizationCodeFlow(req, res)
        } else if (grantType === 'client_credentials') {
            clientCredentialsFlow(req, res)
        }
    }
}

async function authorizationCodeFlow(req: Request, res: Response) {
    // Validate request
    const code: unknown = req.body.code
    if (typeof code !== 'string') {
        sendError(res, missingRequiredPropertyError('code', 'body'))
        return
    }

    // Get token from Gamma
    try {
        await authorizationCode.generateToken(code)
    } catch (error) {
        const unreachable =
            (error as NodeJS.ErrnoException)?.code === 'ENOTFOUND' ||
            (error as NodeJS.ErrnoException)?.code === 'ECONNREFUSED'
        if (unreachable) {
            console.warn(
                `Unable to reach Gamma when logging in user: ${(error as Error).message}`
            )
            sendError(res, ApiError.UnreachableGamma)
        } else {
            console.error(`Failed to get token from Gamma: ${error}`)
            if (
                error instanceof Error &&
                (error as Error).message.includes('400')
            ) {
                sendError(res, ApiError.AuthorizationCodeUsed)
            } else {
                sendError(res, ApiError.GammaToken)
            }
        }
        return
    }

    let userInfo: gamma.UserInfo
    let gammaUserId: gamma.UserId
    let groups: gamma.GroupWithPost[]
    try {
        userInfo = await authorizationCode.userInfo()
        gammaUserId = userInfo.sub
        groups = await clientApi.getGroupsFor(gammaUserId)
    } catch (error) {
        if (
            (error as NodeJS.ErrnoException).code === 'ENOTFOUND' ||
            (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'
        ) {
            sendError(res, ApiError.UnreachableGamma)
        } else {
            const message = `Failed to fetch Gamma info for login: ${error}`
            console.error(message)
            sendError(res, unexpectedError(message))
        }
        return
    }

    const group = getAuthorizedGroup(groups)
    if (!group) {
        // User is not in the super group
        sendError(res, ApiError.NoPermission)
        return
    }
    const gammaGroupId: gamma.GroupId = group.id

    const offlineGroupUser: OfflineGroupUser = await softAddGroupUser(
        gammaGroupId,
        gammaUserId
    )
    const groupUser: GroupUser = completeGroupUser(
        offlineGroupUser,
        userInfo,
        group
    )

    signUserJwt({
        user: {
            id: groupUser.user.id,
            gammaId: groupUser.user.gammaId,
        },
        group: {
            id: groupUser.group.id,
            gammaId: groupUser.group.gammaId,
        },
    })
        .then(token => {
            const body = toLoginResponse(groupUser, token)
            res.json(body)
        })
        .catch(error => {
            sendError(res, tokenSignError(String(error)))
        })
}

interface ClientCredentials {
    clientId: string
    clientSecret: string
}

function parseClientCredentials(req: Request): ClientCredentials {
    const authorizationHeader = req.header('Authorization')
    if (authorizationHeader) {
        try {
            const basic = authorizationHeader.split(' ')[1]
            const decoder = new TextDecoder('utf8')
            const decoded: string = decoder.decode(fromBase64(basic))
            const [clientId, clientSecret] = decoded.split(':')
            return { clientId, clientSecret }
        } catch {
            throw ApiError.InvalidAuthorizationHeader
        }
    } else {
        const clientId: unknown = req.body['client_id']
        if (typeof clientId !== 'string') {
            throw missingRequiredPropertyError('client_id', 'body')
        }
        const clientSecret: unknown = req.body['client_secret'] as string
        if (typeof clientSecret !== 'string') {
            throw missingRequiredPropertyError('client_secret', 'body')
        }
        return { clientId, clientSecret }
    }
}

async function clientCredentialsFlow(req: Request, res: Response) {
    // Validate request
    let credentials: ClientCredentials
    try {
        credentials = parseClientCredentials(req)
    } catch (err) {
        sendError(res, err as ErrorResolvable)
        return
    }
    const { clientId, clientSecret } = credentials

    // Check secret
    const clientDetails = await getGroupClientDetailsWithSecretHash(clientId)
    if (!clientDetails) {
        sendError(res, ApiError.InvalidCredentials)
        return
    }

    const isCorrectSecret = await checkClientSecret(
        clientSecret,
        clientDetails.secretHash,
        clientDetails.salt
    )
    if (!isCorrectSecret) {
        sendError(res, ApiError.InvalidCredentials)
        return
    }

    // Sign token
    signGroupClientJwt({
        client: {
            id: clientDetails.id,
            displayName: clientDetails.displayName,
        },
        group: {
            id: clientDetails.group.id,
            gammaId: clientDetails.group.gammaId as gamma.GroupId,
        },
        scope: clientDetails.scope,
    })
        .then(token => {
            res.json(token)
        })
        .catch(error => {
            sendError(res, tokenSignError(String(error)))
        })
}
