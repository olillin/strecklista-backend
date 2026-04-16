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
import type { DecimalToNumber } from '@/util/decimalToNumber.js'

export type ResponseBody<T> = [T] extends [never]
    ? { error: ResponseError }
    : { data: T }

export interface ResponseError {
    code: number
    message: string
}

export type GroupUserResponse = DecimalToNumber<{
    user: User
    group: Group
    balance: number
}>

export type GroupResponse = DecimalToNumber<{
    group: Group
    members: GroupMember[]
}>

export type LoginResponse = JwtWithToken & GroupUserResponse

export type ItemsResponse = DecimalToNumber<{
    items: Item[]
}>

export type ItemResponse = DecimalToNumber<{
    item: Item
}>

export type TransactionResponse = DecimalToNumber<{
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
    DecimalToNumber<{
        transactions: Transaction<TransactionType>[]
    }>

export interface GroupClientResponse {
    id: string
    scope: string
    group: Group
    owner: User
    displayName: string
    description?: string
}

export interface NewGroupClientResponse extends GroupClientResponse {
    secret: string
}

export function toGroupUserResponse(groupUser: GroupUser): GroupUserResponse {
    return {
        user: groupUser.user,
        group: groupUser.group,
        balance: groupUser.balance.toNumber(),
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
