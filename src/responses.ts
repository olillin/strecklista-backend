import { JWT } from './routes/login'
import {
    User,
    Group,
    completeUser,
    completeGroup,
    GammaUser,
} from './services/gammaService'
import { Item } from './services/itemService'
import {
    AnyTransaction,
    Transaction,
    TransactionType,
} from './services/transactionService'
import { OfflineGroupUser } from './services/userService'
import * as gamma from 'gammait'
import { ToJSON } from './util/convertToJson'

export type ResponseBody<T> = [T] extends [never]
    ? { error: ResponseError }
    : { data: T }

export interface ResponseError {
    code: number
    message: string
}

export type UserResponse = ToJSON<{
    user: User
    group: Group
}>

export type GroupResponse = ToJSON<{
    group: Group
    members: User[]
}>

export interface LoginResponse extends UserResponse, JWT {
    token_type: string
}

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

export function toUserResponse(
    groupUser: OfflineGroupUser,
    gammaUser: GammaUser,
    gammaGroup: gamma.Group
): UserResponse {
    const user = completeUser(groupUser.user, gammaUser)
    return {
        user: {
            ...user,
            balance: user.balance.toNumber(),
        },
        group: completeGroup(groupUser.group, gammaGroup),
    }
}

export function toLoginResponse(
    groupUser: OfflineGroupUser,
    gammaUser: GammaUser,
    gammaGroup: gamma.Group,
    token: JWT
): LoginResponse {
    return {
        access_token: token.access_token,
        token_type: 'Bearer',
        expires_in: token.expires_in,
        ...toUserResponse(groupUser, gammaUser, gammaGroup),
    }
}
