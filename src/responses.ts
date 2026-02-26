import { JWT } from './routes/login'
import {
    User,
    Group,
    completeUser,
    completeGroup,
    GammaUser,
} from './services/gammaService'
import { Item } from './services/itemService'
import { Transaction, TransactionType } from './services/transactionService'
import { OfflineGroupUser } from './services/userService'
import * as gamma from 'gammait'

export type ResponseBody<T> = [T] extends [never]
    ? { error: ResponseError }
    : { data: T }

export interface ResponseError {
    code: number
    message: string
}

export interface UserResponse {
    user: User
    group: Group
}

export interface GroupResponse {
    group: Group
    members: User[]
}

export interface LoginResponse extends UserResponse, JWT {
    token_type: string
}

export interface ItemsResponse {
    items: Item[]
}

export interface ItemResponse {
    item: Item
}

export interface TransactionResponse {
    transaction: Transaction<TransactionType>
}

export interface CreatedTransactionResponse extends TransactionResponse {
    balance: number
}

export interface PaginatedResponse {
    next?: string
    previous?: string
}

export interface TransactionsResponse extends PaginatedResponse {
    transactions: Transaction<TransactionType>[]
}

export function toUserResponse(
    groupUser: OfflineGroupUser,
    gammaUser: GammaUser,
    gammaGroup: gamma.Group
): UserResponse {
    return {
        user: completeUser(groupUser.user, gammaUser),
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
