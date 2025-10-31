import { Response } from 'express'
import { Location } from 'express-validator'
import { ErrorDefinition, ErrorResolvable, ErrorResponseBody } from './types'

// Pre-defined errors
export enum ApiError {
    InvalidUserId,
    UserNotExist,
    InvalidItemId,
    ItemNotExist,
    InvalidTransactionId,
    TransactionNotExist,
    InvalidUrl,

    // Authorization
    Unauthorized,
    ExpiredToken,
    InvalidToken,
    BeforeNbf,
    NoPermission,

    // Gamma
    GammaToken,
    InvalidGammaResponse,
    UnreachableGamma,
    FailedGetGroups,

    // Login
    NoAuthorizationCode,
    AuthorizationCodeUsed,

    // Create purchase
    PurchaseItemCount,
    PurchaseNothing,
    PurchaseInvisible,
    InvalidComment,

    // Create deposit
    InvalidTotal,

    // Create stock update
    StockItemCount,
    StockNothing,

    // Delete transaction
    CannotDeleteTransaction,

    // List transactions
    InvalidOffset,
    InvalidLimit,

    // Create/modify item
    DisplayNameNotUnique,
    MissingPrices,

    // List items
    UnknownSortMode,
}

function err(code: number, message: string): ErrorDefinition {
    return { code, message }
}

const errorDefinitions: { [key in ApiError]: ErrorDefinition } = {
    [ApiError.InvalidUserId]: err(400, 'Invalid user ID'),
    [ApiError.UserNotExist]: err(404, 'User does not exist'),
    [ApiError.InvalidItemId]: err(400, 'Invalid item ID'),
    [ApiError.ItemNotExist]: err(404, 'Item does not exist'),
    [ApiError.InvalidTransactionId]: err(400, 'Invalid transaction ID'),
    [ApiError.TransactionNotExist]: err(404, 'Transaction does not exist'),
    [ApiError.InvalidUrl]: err(400, 'URL is invalid'),

    // Authorization
    [ApiError.Unauthorized]: err(401, 'Unauthorized'),
    [ApiError.ExpiredToken]: err(401, 'Token is expired'),
    [ApiError.InvalidToken]: err(401, 'Token is invalid, generate a new one'),
    [ApiError.BeforeNbf]: err(401, 'Token cannot be used yet'),
    [ApiError.NoPermission]: err(403, 'No permission to access this service'),

    // Gamma
    [ApiError.GammaToken]: err(502, 'Failed to get token from Gamma, your authorization code may be invalid'),
    [ApiError.InvalidGammaResponse]: err(502, 'Received an invalid response from Gamma'),
    [ApiError.UnreachableGamma]: err(504, 'Unable to reach Gamma'),
    [ApiError.FailedGetGroups]: err(502, 'Failed to get groups for user'),

    // Login
    [ApiError.NoAuthorizationCode]: err(401, 'No authorization code provided'),
    [ApiError.AuthorizationCodeUsed]: err(401, 'Authorization code has already been used'),

    // Create purchase
    [ApiError.PurchaseItemCount]: err(400, 'Item count must be an integer greater than 0'),
    [ApiError.PurchaseNothing]: err(400, 'Must purchase at least one item'),
    [ApiError.PurchaseInvisible]: err(403, 'Cannot purchase a non-visible item'),
    [ApiError.InvalidComment]: err(400, 'Comment must not be longer than 1000 characters'),

    // Create deposit
    [ApiError.InvalidTotal]: err(400, 'Total must be a number'),

    // Create stock update
    [ApiError.StockItemCount]: err(400, 'Item quantity must be an integer'),
    [ApiError.StockNothing]: err(400, 'Must update the stock of at least one item'),

    // Delete transaction
    [ApiError.CannotDeleteTransaction]: err(405, "Transactions cannot be deleted, please use PATCH and the 'removed' flag"),

    // List purchase
    [ApiError.InvalidLimit]: err(400, 'Limit must be an integer between 1 and 100'),
    [ApiError.InvalidOffset]: err(400, 'Offset must be a positive integer'),

    // Create/modify Item
    [ApiError.DisplayNameNotUnique]: err(403, 'Display name is not unique'),
    [ApiError.MissingPrices]: err(400, 'An item must have at least one price'),

    // List items
    [ApiError.UnknownSortMode]: err(400, 'Unknown sort order'),
}

export function getErrorDefinition(error: ApiError): ErrorDefinition {
    const definition = errorDefinitions[error]
    return err(definition.code, definition.message)
}

export function getErrorCode(error: ApiError): number {
    return errorDefinitions[error].code
}

export function getErrorMessage(error: ApiError): string {
    return errorDefinitions[error].message
}

// #region Parameterized Errors
export function missingRequiredPropertyError(name: string, location: Location): ErrorDefinition {
    return err(400, `Missing required property '${name}' in ${location}`)
}

export function invalidPropertyError(name: string, location: Location): ErrorDefinition {
    return err(400, `Property '${name}' is invalid in ${location}`)
}

export function unexpectedError(details: string) {
    return err(500, `An unexpected issue occured. Please create an issue on GitHub. Details: ${details}`)
}

export function tokenSignError(details: string): ErrorDefinition {
    return err(500, `Failed to sign JWT: ${details}`)
}
// #endregion Parameterized Errors

export function isErrorResolvable(maybeError: any): maybeError is ErrorResolvable {
    if (typeof maybeError === 'object') {
        return Object.hasOwn(maybeError, 'code') && typeof maybeError.code === 'number' && Object.hasOwn(maybeError, 'message') && typeof maybeError.message === 'string'
    } else if (typeof maybeError === 'number') {
        return Object.values(ApiError).includes(maybeError)
    }
    return false
}

export function resolveError(error: ErrorResolvable): ErrorDefinition {
    if (typeof error === 'number') {
        // error is ApiError
        return getErrorDefinition(error)
    } else {
        return error
    }
}

export function sendError(res: Response, error: ErrorResolvable): void
export function sendError(res: Response, code: number, message: string): void
export function sendError(res: Response, a: number | ErrorResolvable, b?: string): void {
    if (res.headersSent) return

    let code: number
    let message: string

    if (b) {
        code = a as number
        message = b
    } else {
        const error = resolveError(a as ErrorResolvable)
        code = error.code
        message = error.message
    }

    const body: ErrorResponseBody = {
        error: {
            code: code,
            message: message,
        },
    }
    res.status(code).json(body)
}
