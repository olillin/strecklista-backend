import { NextFunction, Request, Response } from 'express'
import { clientApi } from '../../config/gamma'
import { GroupId, UserId } from 'gammait'
import {
    getGammaGroupId,
    getGammaUserId,
    getGroupId,
} from '../../middleware/validateToken'
import { ApiError, sendError } from '../../errors'
import { GroupResponse, ResponseBody } from '../../responses'
import { getAuthorizedGroup } from '../../util/helpers'
import {
    getOfflineUsersInGroup,
    OfflineGroup,
} from '../../services/userService'
import {
    completeUser,
    completeGroup,
    GroupMember,
} from '../../services/gammaService'
import { DecimalToNumber } from '../../util/decimalToNumber'

export default async function getGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const gammaUserId: UserId = getGammaUserId(res)
        const gammaGroupId: GroupId = getGammaGroupId(res)
        const groupId = getGroupId(res)

        // Get group
        const gammaGroups = await clientApi
            .getGroupsFor(gammaUserId)
            .catch(reason => {
                console.log(reason)
                return null
            })
        if (!gammaGroups) {
            sendError(res, ApiError.FailedGetGroups)
            return
        }
        const gammaGroup = getAuthorizedGroup(gammaGroups)
        if (!gammaGroup) {
            sendError(res, ApiError.NoPermission)
            return
        }

        // Get members
        const offlineGroupUsers = await getOfflineUsersInGroup(groupId)
        let members: DecimalToNumber<GroupMember[]>
        try {
            members = await Promise.all(
                offlineGroupUsers.map(async offlineGroupUser => {
                    const gammaUser = await clientApi
                        .getUser(offlineGroupUser.user.gammaId)
                        .catch(() => null)
                    if (gammaUser === null) {
                        console.warn(
                            `Failed to get user ${offlineGroupUser.user.gammaId} in group ${gammaGroup.id} from Gamma`
                        )
                    }
                    const user = completeUser(offlineGroupUser.user, gammaUser)
                    return {
                        ...user,
                        balance: offlineGroupUser.balance.toNumber(),
                    } satisfies DecimalToNumber<GroupMember>
                })
            )
        } catch (e) {
            const message = `Failed to get users from gamma: ${e}`
            console.error(message)
            sendError(res, ApiError.InvalidGammaResponse)
            return
        }

        const offlineGroup: OfflineGroup = {
            id: groupId,
            gammaId: gammaGroupId,
        }
        const group = completeGroup(offlineGroup, gammaGroup)

        const body: ResponseBody<GroupResponse> = { data: { group, members } }
        res.json(body)
    } catch (error) {
        next(error)
    }
}
