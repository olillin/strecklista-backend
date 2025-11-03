import { NextFunction, Request, RequestHandler, Response } from 'express'
import { GroupId, UserId } from 'gammait'
import jwt from 'jsonwebtoken'
import { authorizationCode, clientApi, database } from '../config/clients'
import env from '../config/env'
import { ApiError, tokenSignError } from '../errors'
import { JWT, LoggedInUser } from '../types'
import * as convert from '../util/convert'
import { getAuthorizedGroup } from '../util/helpers'

function signJWT(user: LoggedInUser): Promise<JWT> {
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
    return async (req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Allow', 'POST')
        try {
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
                    throw ApiError.UnreachableGamma
                } else {
                    console.error(`Failed to get token from Gamma: ${error}`)
                    if (
                        error instanceof Error &&
                        (error as Error).message.includes('400')
                    ) {
                        throw ApiError.AuthorizationCodeUsed
                    } else {
                        throw ApiError.GammaToken
                    }
                }
            }

            const userInfo = await authorizationCode.userInfo()
            const gammaUserId: UserId = userInfo.sub
            const groups = await clientApi.getGroupsFor(gammaUserId)
            const group = getAuthorizedGroup(groups)
            if (!group) {
                // User is not in the super group
                return next(ApiError.NoPermission)
            }
            const gammaGroupId: GroupId = group.id

            const dbUser = await database.softCreateGroupAndUser(
                gammaGroupId,
                gammaUserId
            )

            signJWT({
                userId: dbUser.id,
                groupId: dbUser.group_id,
                gammaUserId: dbUser.gamma_id,
                gammaGroupId: dbUser.group_gamma_id,
            })
                .then(token => {
                    const body = convert.toLoginResponse(
                        dbUser,
                        userInfo,
                        group,
                        token
                    )
                    res.json(body)
                })
                .catch(error => {
                    next(tokenSignError(String(error)))
                })
        } catch (error) {
            if (
                (error as NodeJS.ErrnoException).code === 'ENOTFOUND' ||
                (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'
            ) {
                throw ApiError.UnreachableGamma
            }
        }
    }
}
