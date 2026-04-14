import { JWT } from './routes/login'
import { User, Group, GroupUser, GroupMember } from './services/gammaService'
import { Item } from './services/itemService'
import {
    AnyTransaction,
    Transaction,
    TransactionType,
} from './services/transactionService'
import { DecimalToNumber } from './util/decimalToNumber'

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

export interface LoginResponse extends GroupUserResponse, JWT {
    token_type: string
}

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

export interface ClientResponse {
    id: string
    scope: string
    group: Group
    owner: User
    displayName: string
    description?: string
}

export interface NewClientResponse extends ClientResponse {
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
    token: JWT
): LoginResponse {
    return {
        access_token: token.access_token,
        token_type: 'Bearer',
        expires_in: token.expires_in,
        ...toGroupUserResponse(groupUser),
    }
}
