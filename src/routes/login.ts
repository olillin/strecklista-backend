import { Request, RequestHandler, Response } from 'express'
import { GroupId, GroupWithPost, UserId, UserInfo } from 'gammait'
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import { authorizationCode, clientApi } from '../config/gamma'
import env from '../config/env'
import { ApiError, sendError, tokenSignError, unexpectedError } from '../errors'
import { getAuthorizedGroup } from '../util/helpers'
import { OfflineGroupUser, softAddGroupUser } from '../services/userService'
import { toLoginResponse } from '../responses'
import { completeGroupUser, GroupUser } from '../services/gammaService'
import { ulid } from 'ulid'

export interface JWT extends JwtPayload {
    access_token: string
    token_type: 'Bearer'
}

export interface LoggedInUser {
    userId: number
    groupId: number
    gammaUserId: UserId
    gammaGroupId: GroupId
}

export function isLoggedInUser(value: unknown): value is LoggedInUser {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const obj = value as Record<string, unknown>

    return (
        typeof obj.userId === 'number' &&
        typeof obj.groupId === 'number' &&
        'gammaUserId' in obj &&
        'gammaGroupId' in obj
    )
}

function signUserJwt(user: LoggedInUser): Promise<JWT> {
    return new Promise((resolve, reject) => {
        const expireSeconds = parseInt(env.JWT_EXPIRES_IN)

        try {
            jwt.sign(
                user,
                env.JWT_SECRET,
                {
                    issuer: env.JWT_ISSUER,
                    subject: String(user.userId),
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

export function login(): RequestHandler {
    return async (req: Request, res: Response) => {
        res.setHeader('Allow', 'POST')

        // Validate request
        const code = (req.query.code ?? req.body.code) as string

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

        let userInfo: UserInfo
        let gammaUserId: UserId
        let groups: GroupWithPost[]
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
        const gammaGroupId: GroupId = group.id

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
            userId: groupUser.user.id,
            groupId: groupUser.group.id,
            gammaUserId: groupUser.user.gammaId,
            gammaGroupId: groupUser.group.gammaId,
        })
            .then(token => {
                const body = toLoginResponse(groupUser, token)
                res.json(body)
            })
            .catch(error => {
                sendError(res, tokenSignError(String(error)))
            })
    }
}
