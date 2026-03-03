import { Request, RequestHandler, Response } from 'express'
import { GroupId, GroupWithPost, UserId, UserInfo } from 'gammait'
import jwt from 'jsonwebtoken'
import { authorizationCode, clientApi } from '../config/gamma'
import env from '../config/env'
import { ApiError, sendError, tokenSignError, unexpectedError } from '../errors'
import { getAuthorizedGroup } from '../util/helpers'
import { softAddGroupUser } from '../services/userService'
import { toLoginResponse } from '../responses'

export interface JWT {
    access_token: string
    expires_in: number
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

function signJwt(user: LoggedInUser): Promise<JWT> {
    return new Promise((resolve, reject) => {
        const expireSeconds = parseFloat(env.JWT_EXPIRES_IN)

        console.log(`Signing token for ${user.gammaUserId}`)

        try {
            jwt.sign(
                user,
                env.JWT_SECRET,
                {
                    issuer: env.JWT_ISSUER,
                    algorithm: 'HS256',
                    expiresIn: expireSeconds,
                },
                (error, token) => {
                    if (error) reject(error)
                    else if (token)
                        resolve({
                            access_token: token,
                            expires_in: expireSeconds,
                        })
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

        const groupUser = await softAddGroupUser(gammaGroupId, gammaUserId)

        signJwt({
            userId: groupUser.user.id,
            groupId: groupUser.group.id,
            gammaUserId: groupUser.user.gammaId,
            gammaGroupId: groupUser.group.gammaId,
        })
            .then(token => {
                const body = toLoginResponse(groupUser, userInfo, group, token)
                res.json(body)
            })
            .catch(error => {
                sendError(res, tokenSignError(String(error)))
            })
    }
}
