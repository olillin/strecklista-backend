export enum ItemFlag {
    VISIBLE = 0
}

export interface ItemFlags {
    visible: boolean
}

export enum TransactionFlag {
    REMOVED = 0
}

export interface TransactionFlags {
    removed: boolean
}

/**
 * Get the value of a flag from a flag int and a flag index
 * @param bits The bitfield data
 * @param flagIndex Which flag to get, as an index from the least significant bit
 */
export function getFlag(bits: number | null | undefined, flagIndex: number): boolean {
    if (!bits) return false
    return !!((bits >> flagIndex) & 0b1)
}

/**
 * Get all transaction flags from a flag int
 * @param bits The bitfield data
 */
export function parseTransactionFlags(bits: number | null | undefined): TransactionFlags {
    return {
        removed: getFlag(bits, TransactionFlag.REMOVED),
    }
}

/**
 * Parse item flags from a bitfield
 * @param bits The bitfield data
 */
export function parseItemFlags(bits: number | null | undefined): ItemFlags {
    return {
        visible: getFlag(bits, ItemFlag.VISIBLE),
    }
}

/**
 * Convert a map of item flags to a bitfield
 * @param flags The item flags
 * @return The bitfield
 */
export function serializeItemFlags(flags: Partial<ItemFlags>): number {
    return Number(flags.visible) << ItemFlag.VISIBLE
}

/**
 * Convert a map of transaction flags to a bitfield
 * @param flags The transaction flags
 * @return The bitfield
 */
export function serializeTransactionFlags(flags: Partial<TransactionFlags>): number {
    return Number(flags.removed) << TransactionFlag.REMOVED
}

