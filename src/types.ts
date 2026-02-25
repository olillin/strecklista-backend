import { GroupId, UserId } from 'gammait'
import { JwtPayload } from 'jsonwebtoken'
import { itemSortModes } from './middleware/validators'
import { ApiError } from './errors'
import { Item, Price } from './services/itemService'
import { Transaction, TransactionType } from './services/transactionService'
import { User, Group } from './services/gammaService'

// #region Response types
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

export interface JWT {
    access_token: string
    expires_in: number
}

export interface LoggedInUser {
    userId: number
    groupId: number
    gammaUserId: UserId
    gammaGroupId: GroupId
}

export interface LocalJwt extends JwtPayload, LoggedInUser {}

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
// #endregion Response types

// #region Request types
export interface PostPurchaseBody {
    userId: number
    items: PurchaseItem[]
    comment?: string
}

export interface PurchaseItem {
    id: number
    quantity: number
    purchasePrice: Price
}

export interface PostDepositBody {
    userId: number
    total: number
    comment?: string
}

export interface PostStockUpdateBody {
    items: PostItemStockUpdate[]
    comment?: string
}

export interface PostItemStockUpdate {
    id: number
    quantity: number
    absolute?: boolean
}

export interface PatchTransactionBody {
    removed?: boolean
}

export interface PostItemBody {
    displayName: string
    prices: Price[]
    icon?: string
}

export interface PatchItemBody {
    icon?: string
    displayName?: string
    prices?: Price[]
    visible?: boolean
    favorite?: boolean
}
// #endregion Request types

export type ItemSortMode = (typeof itemSortModes)[number]

export interface ErrorDefinition {
    code: number
    message: string
}
export type ErrorResolvable = ErrorDefinition | ApiError
