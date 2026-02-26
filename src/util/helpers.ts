import { GroupWithPost } from 'gammait'
import environment from '../config/env'

export function getAuthorizedGroup(
    groups: GroupWithPost[]
): GroupWithPost | undefined {
    return groups.find(
        group => group.superGroup.id === environment.SUPER_GROUP_ID
    )
}

export function isValidComment(comment: string | undefined | null): boolean {
    return !!comment && comment.length > 1
}

/**
 * Get the value of a flag from bitfield and a flag index
 * @param bits The bitfield data
 * @param flagIndex Which flag to get, as an index from the least significant bit
 */
export function getFlag(
    bits: number | null | undefined,
    flagIndex: number
): boolean {
    if (!bits) return false
    return !!((bits >> flagIndex) & 0b1)
}
