import type { JwtWithToken } from '@/routes/oauth2/token.js'
import type {
    User,
    Group,
    GroupUser,
    GroupMember,
} from '@/services/gammaService.js'
import type { Item } from '@/services/itemService.js'
import type {
    AnyTransaction,
    Transaction,
    TransactionType,
} from '@/services/transactionService.js'
import type {
    GroupClient,
    GroupClientWithSecret,
} from '@/services/clientService.js'
import type { ToJSON } from '@/util/convertToJson.js'

export type ResponseBody<T> = [T] extends [never]
    ? { error: ResponseError }
    : { data: T }

export interface ResponseError {
    code: number
    message: string
}

export type GroupUserResponse = ToJSON<{
    user: User
    group: Group
    balance: number
    externalId?: number
}>

export type GroupResponse = ToJSON<{
    group: Group
    members: GroupMember[]
}>

export type LoginResponse = JwtWithToken & GroupUserResponse

export type ItemsResponse = ToJSON<{
    items: Item[]
}>

export type ItemResponse = ToJSON<{
    item: Item
}>

export type TransactionResponse = ToJSON<{
    transaction: AnyTransaction
}>

export type CreatedTransactionResponse = TransactionResponse & {
    balance: number
}

export interface PaginatedResponse {
    next?: string
    previous?: string
}

export type TransactionsResponse = PaginatedResponse &
    ToJSON<{
        transactions: Transaction<TransactionType>[]
    }>

export interface GroupClientResponse {
    client: GroupClient
}

export interface GroupClientsResponse {
    clients: GroupClient[]
}

export interface NewGroupClientResponse {
    client: GroupClientWithSecret
}

export function toGroupUserResponse(groupUser: GroupUser): GroupUserResponse {
    return {
        user: groupUser.user,
        group: groupUser.group,
        balance: groupUser.balance.toNumber(),
        externalId: groupUser.externalId,
    }
}

export function toLoginResponse(
    groupUser: GroupUser,
    token: JwtWithToken
): LoginResponse {
    return {
        ...token,
        ...toGroupUserResponse(groupUser),
    }
}
