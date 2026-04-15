import { Request, RequestHandler, Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import env from '../../config/env'
import { ApiError, sendError, tokenSignError } from '../../errors'
import {
    checkClientSecret,
    getGroupClientDetailsWithSecretHash,
} from '../../services/clientService'
import { JWT } from '../login'
import { ulid } from 'ulid'

export const acceptedGrantType = 'client_credentials'
export const acceptedTokenAudience = env.JWT_ISSUER

export interface LoggedInGroupClient {
    clientId: string
    scope: string
    groupId: number
    displayName: string
}

export function isLoggedInUser(value: unknown): value is LoggedInGroupClient {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const obj = value as Record<string, unknown>

    return typeof obj.clientId === 'string' && typeof obj.groupId === 'number'
}

function signGroupClientJwt(client: LoggedInGroupClient): Promise<JWT> {
    return new Promise((resolve, reject) => {
        const expireSeconds = parseInt(env.JWT_EXPIRES_IN)

        try {
            jwt.sign(
                {
                    client: {
                        clientId: client.clientId,
                        groupId: client.groupId,
                        displayName: client.displayName,
                    },
                    scope: client.scope,
                },
                env.JWT_SECRET,
                {
                    issuer: env.JWT_ISSUER,
                    audience: client.clientId,
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

        // Validate request
        const clientId = req.body['client_id'] as string
        const clientSecret = req.body['client_secret'] as string
        // Not used since already validated
        // const grantType = req.body['grant_type'] as string
        // const audience = req.body['audience'] as string

        const clientDetails =
            await getGroupClientDetailsWithSecretHash(clientId)
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

        signGroupClientJwt({
            clientId: clientDetails.id,
            scope: clientDetails.scope,
            groupId: clientDetails.groupId,
            displayName: clientDetails.displayName,
        })
            .then(token => {
                res.json(token)
            })
            .catch(error => {
                sendError(res, tokenSignError(String(error)))
            })
    }
}
