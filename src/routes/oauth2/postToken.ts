import type { Request, Response } from 'express'
import {
    ApiError,
    missingRequiredPropertyError,
    sendError,
    tokenSignError,
    unexpectedError,
    type ErrorResolvable,
} from '@/lib/errors.js'
import {
    checkClientSecret,
    getGroupClientDetailsWithSecretHash,
} from '@/services/clientService.js'
import * as gamma from 'gammait'
import { authorizationCode, clientApi } from '@/lib/gamma.js'
import { getAuthorizedGroup } from '@/util/helpers.js'
import {
    type OfflineGroupUser,
    softAddGroupUser,
} from '@/services/userService.js'
import { completeGroupUser, type GroupUser } from '@/services/gammaService.js'
import { type LoginResponse } from '@/lib/responses.js'
import { fromBase64 } from '@exodus/bytes/base64.js'
import {
    signGroupClientJwt,
    signUserJwt,
    type ClientCredentials,
    type GrantType,
} from '@/lib/token.js'

export default async function routeHandler(
    req: Request,
    res: Response
): Promise<void> {
    const grantType = req.body['grant_type'] as GrantType
    if (grantType === 'authorization_code') {
        await authorizationCodeFlow(req, res)
    } else if (grantType === 'client_credentials') {
        await clientCredentialsFlow(req, res)
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

    await signUserJwt({
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
            // Do not put in 'data' as the token must be in root.
            const body: LoginResponse = {
                ...token,
                ...groupUser,
            }
            res.json(body)
        })
        .catch(error => {
            sendError(res, tokenSignError(String(error)))
        })
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
