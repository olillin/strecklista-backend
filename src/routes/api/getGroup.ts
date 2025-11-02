import { Request, Response } from 'express'
import { UserId } from 'gammait'
import { clientApi, database } from '../../config/clients'
import * as tableType from '../../database/types'
import { ApiError } from '../../errors'
import { getGammaUserId, getGroupId } from '../../middleware/validateToken'
import { GroupResponse, ResponseBody, User } from '../../types'
import * as convert from '../../util/convert'
import { getAuthorizedGroup } from '../../util/helpers'

export default async function getGroup(req: Request, res: Response) {
    const gammaUserId: UserId = getGammaUserId(res)
    const groupId = getGroupId(res)

    // Get group
    const gammaGroups = await clientApi
        .getGroupsFor(gammaUserId)
        .catch(reason => {
            console.log(reason)
            return null
        })
    if (!gammaGroups) {
        throw ApiError.FailedGetGroups
    }
    const gammaGroup = getAuthorizedGroup(gammaGroups)
    if (!gammaGroup) {
        throw ApiError.NoPermission
    }

    // Get members
    const fullUsersInGroup = await database.getFullUsersInGroup(groupId)
    let userPromises: Promise<User>[]
    try {
        userPromises = fullUsersInGroup.map(async dbUser => {
            const gammaUser = await clientApi
                .getUser(dbUser.gamma_id)
                .catch(() => null)
            if (!gammaUser) {
                console.warn(
                    `Failed to get user ${dbUser.gamma_id} in group ${dbUser.group_gamma_id} from Gamma`
                )
            }
            return convert.toUser(dbUser, gammaUser)
        })
    } catch (e) {
        console.error(`Failed to get users from Gamma: ${e}`)
        throw ApiError.FailedGetGroupUsers
    }
    const members = await Promise.all(userPromises)

    const dbGroup: tableType.Groups = {
        id: fullUsersInGroup[0].group_id,
        gamma_id: fullUsersInGroup[0].group_gamma_id,
    }
    const group = convert.toGroup(dbGroup, gammaGroup)
    const body: ResponseBody<GroupResponse> = { data: { group, members } }
    res.json(body)
}
