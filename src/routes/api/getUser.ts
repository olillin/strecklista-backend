import { NextFunction, Request, Response } from 'express'
import { GroupWithPost, User, UserId } from 'gammait'
import { clientApi, database } from '../../config/clients'
import { FullUser } from '../../database/types'
import { ApiError, isErrorResolvable } from '../../errors'
import { getGammaUserId, getUserId } from '../../middleware/validateToken'
import { ErrorResolvable, ResponseBody, UserResponse } from '../../types'
import * as convert from '../../util/convert'
import { getAuthorizedGroup } from '../../util/helpers'

export default async function getUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const userId: number = getUserId(res)
    const gammaUserId: UserId = getGammaUserId(res)
    console.log(`Getting user info for: ${userId}`)

    // Get requests
    const dbUserPromise: Promise<FullUser | undefined | ErrorResolvable> =
        database.getFullUser(userId).catch(reason => {
            console.error(`Failed to fetch user from database: ${reason}`)
            return ApiError.Unexpected
        })
    const gammaUserPromise: Promise<User | ErrorResolvable> = clientApi
        .getUser(gammaUserId)
        .catch(reason => {
            console.warn(`Failed to fetch user from Gamma: ${reason}`)
            const fetchFailed = String(reason).includes('fetch failed')
            return fetchFailed
                ? ApiError.UnreachableGamma
                : ApiError.InvalidGammaResponse
        })
    const groupsPromise: Promise<GroupWithPost[] | ErrorResolvable> = clientApi
        .getGroupsFor(gammaUserId)
        .catch(reason => {
            console.warn('Failed to fetch groups from Gamma')
            const fetchFailed = String(reason).includes('fetch failed')
            return fetchFailed
                ? ApiError.UnreachableGamma
                : ApiError.InvalidGammaResponse
        })

    // Await promises
    const promises = [dbUserPromise, gammaUserPromise, groupsPromise]
    // Check for errors
    for (const promise of promises) {
        const result = await promise
        if (isErrorResolvable(result)) return next(result)
    }

    const [dbUser, gammaUser, groups] = (await Promise.all(promises)) as [
        FullUser | undefined,
        User,
        GroupWithPost[]
    ]

    if (dbUser === undefined) return next(ApiError.UserNotExist)

    const group = getAuthorizedGroup(groups)
    if (!group) {
        return next(ApiError.NoPermission)
    }

    const body: ResponseBody<UserResponse> = {
        data: convert.toUserResponse(dbUser, gammaUser, group),
    }
    res.json(body)
}
