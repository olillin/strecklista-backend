import { NextFunction, Request, RequestHandler, Response } from 'express'
import { GroupId, UserId } from 'gammait'
import jwt from 'jsonwebtoken'
import { authorizationCode, clientApi, database } from '../config/clients'
import env from '../config/env'
import { ApiError, isApiError, tokenSignError } from '../errors'
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

        // Validate request
        const code = (req.query.code ?? req.body.code) as string

        // Get token from Gamma
        const tokenResponse: unknown | ApiError = await authorizationCode
            .generateToken(code)
            .catch(reason => {
                console.warn(`Failed to get token from Gamma: ${reason}`)
                const unreachable = String(reason).includes('request error')
                const badRequest = String(reason).includes('400 Bad Request')
                if (unreachable) {
                    return ApiError.UnreachableGamma
                } else if (badRequest) {
                    return ApiError.AuthorizationCodeUsed
                } else {
                    return ApiError.GammaToken
                }
            })
        if (isApiError(tokenResponse)) throw tokenResponse

        const userInfo = await authorizationCode.userInfo().catch(reason => {
            console.warn(`Failed to get user info from Gamma: ${reason}`)
            return ApiError.Unexpected
        })
        if (isApiError(userInfo)) throw userInfo

        const gammaUserId: UserId = userInfo.sub

        const groups = await clientApi
            .getGroupsFor(gammaUserId)
            .catch(reason => {
                console.warn(`Failed to get groups for user: ${reason}`)
                return ApiError.FailedGetGroups
            })
        if (isApiError(groups)) throw groups

        const group = getAuthorizedGroup(groups)
        if (!group) {
            // User is not in the super group
            return next(ApiError.NoPermission)
        }
        const gammaGroupId: GroupId = group.id

        const dbUser = await database
            .softCreateGroupAndUser(gammaGroupId, gammaUserId)
            .catch(reason => {
                console.error(`Failed to create user in database: ${reason}`)
                return ApiError.Unexpected
            })
        if (isApiError(dbUser)) throw dbUser

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
    }
}
