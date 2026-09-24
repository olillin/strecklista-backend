import type { JwtWithToken } from '@/lib/token.js'
import type { Group, GroupUser, GroupMember } from '@/services/gammaService.js'
import type { Item } from '@/services/itemService.js'
import type {
    AnyTransaction,
    Transaction,
    TransactionType,
} from '@/services/transactionService.js'
import type {
    Scope,
    GroupClient,
    GroupClientWithSecret,
} from '@/services/clientService.js'
import { convertToJson, type ToJSON } from '@/util/convertToJson.js'

export type DataResponseBody<T extends object> = { data: ToJSON<T> }
export type ErrorResponseBody = { error: ResponseError }
export type ResponseError = { code: number; message: string }

export function createResponseBody<T extends object>(
    data: T
): DataResponseBody<T> {
    return { data: convertToJson(data) }
}

export type ServiceMetaResponse = {
    version: string
    supportedScopes: Scope[] | readonly Scope[]
}

export type ServiceHealthyResponse = {
    code: 200
    message: string
}

export type GroupResponse = {
    group: Group
    members: GroupMember[]
}

export type LoginResponse = JwtWithToken & GroupUser

export type ItemListResponse = {
    items: Item[]
}

export type ItemResponse = {
    item: Item
}

export type TransactionResponse = {
    transaction: AnyTransaction
}

export type CreatedTransactionResponse = TransactionResponse & {
    balance: number
}

export interface PaginatedResponse {
    count: number
    next?: string
    previous?: string
}

export type TransactionListResponse = PaginatedResponse & {
    transactions: Transaction<TransactionType>[]
}

export interface GroupClientResponse {
    client: GroupClient
}

export interface GroupClientListResponse {
    clients: GroupClient[]
}

export interface NewGroupClientResponse {
    client: GroupClientWithSecret
}
