import { NextFunction, Request, Response } from 'express'
import { clientApi } from '../../config/gamma'
import { getGammaGroupId, getGroupId } from '../../middleware/validateToken'
import { ApiError, sendError } from '../../errors'
import { GroupResponse, ResponseBody } from '../../responses'
import {
    getOfflineUsersInGroup,
    OfflineGroup,
} from '../../services/userService'
import {
    completeUser,
    completeGroup,
    GroupMember,
    getGammaGroup,
} from '../../services/gammaService'
import { DecimalToNumber } from '../../util/decimalToNumber'

export default async function getGroup(
    _req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const groupId = getGroupId(res)
        const gammaGroupId = getGammaGroupId(res)
        if (groupId == null || gammaGroupId == null) {
            sendError(res, ApiError.Unauthorized)
            return
        }

        // Get group
        const gammaGroup = await getGammaGroup(gammaGroupId)
        if (!gammaGroup) {
            sendError(res, ApiError.FailedGetGroup)
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
