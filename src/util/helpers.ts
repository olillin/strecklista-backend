import { GroupWithPost } from 'gammait'
import environment from '../config/env'

export function getAuthorizedGroup(
    groups: GroupWithPost[]
): GroupWithPost | undefined {
    const superGroups = environment.SUPER_GROUP_ID.split(',')
    return groups.find(group => superGroups.includes(group.superGroup.id))
}

export function isValidComment(comment: string | undefined | null): boolean {
    return !!comment && comment.length > 1
}

