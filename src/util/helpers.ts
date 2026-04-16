import * as gamma from 'gammait'
import environment from '@/config/env.js'

export function getAuthorizedGroup(
    groups: gamma.GroupWithPost[]
): gamma.GroupWithPost | undefined {
    const superGroups = environment.SUPER_GROUP_ID.split(',')
    return groups.find(group => superGroups.includes(group.superGroup.id))
}

export function isValidComment(comment: string | undefined | null): boolean {
    return !!comment && comment.length > 1
}
