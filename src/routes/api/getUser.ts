import { Request, Response } from 'express'
import { GroupWithPost, User, UserId } from 'gammait'
import { clientApi, database } from '../../config/clients'
import { FullUser } from '../../database/types'
import { ApiError, isApiError } from '../../errors'
import { getGammaUserId, getUserId } from '../../middleware/validateToken'
import { ResponseBody, UserResponse } from '../../types'
import * as convert from '../../util/convert'
import { getAuthorizedGroup } from '../../util/helpers'

export default async function getUser(req: Request, res: Response) {
    const userId: number = getUserId(res)
    const gammaUserId: UserId = getGammaUserId(res)
    console.log(`Getting user info for: ${userId}`)

    // Get requests
    const dbUserPromise: Promise<FullUser | undefined | ApiError> = database
        .getFullUser(userId)
        .catch(reason => {
            console.error(`Failed to fetch user from database: ${reason}`)
            return ApiError.Unexpected
        })
    const gammaUserPromise: Promise<User | ApiError> = clientApi
        .getUser(gammaUserId)
        .catch(reason => {
            console.warn(`Failed to fetch user from Gamma: ${reason}`)
            const fetchFailed = String(reason).includes('fetch failed')
            return fetchFailed
                ? ApiError.UnreachableGamma
                : ApiError.InvalidGammaResponse
        })
    const groupsPromise: Promise<GroupWithPost[] | ApiError> = clientApi
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
        if (isApiError(result)) {
            console.log(`Passing error ${result}`)
            throw result
        }
    }

    const [dbUser, gammaUser, groups] = (await Promise.all(promises)) as [
        FullUser | undefined,
        User,
        GroupWithPost[]
    ]

    if (dbUser === undefined) throw ApiError.UserNotExist

    const group = getAuthorizedGroup(groups)
    if (!group) {
        throw ApiError.NoPermission
    }

    const body: ResponseBody<UserResponse> = {
        data: convert.toUserResponse(dbUser, gammaUser, group),
    }
    res.json(body)
}
