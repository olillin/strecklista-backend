import { Response } from 'express'
import { Location } from 'express-validator'
import { ErrorBody, ErrorResponseBody } from './types'

export function sendError(res: Response, error: ApiError): void
export function sendError(res: Response, code: number, message: string): void
export function sendError(
    res: Response,
    a: number | ApiError,
    b?: string
): void {
    let code: number
    let message: string

    if (b) {
        code = a as number
        message = b
    } else {
        const error = a as ApiError
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

export function isApiError(maybeError: any): maybeError is ApiError {
    if (typeof maybeError === 'object') {
        return (
            Object.hasOwn(maybeError, 'code') &&
            typeof maybeError.code === 'number' &&
            Object.hasOwn(maybeError, 'message') &&
            typeof maybeError.message === 'string'
        )
    }
    return false
}

export class ApiError extends Error {
    code: number

    constructor(code: number, message: string) {
        super(message)
        this.code = code
    }

    body(): ErrorBody {
        return {
            code: this.code,
            message: this.message,
        }
    }

    // #region Static errors
    // Generic
    static Unexpected = new ApiError(
        500,
        'An unexpected issue occured. Please try again later'
    )
    static RouteNotFound = new ApiError(404, 'This route does not exist')
    static InvalidUserId = new ApiError(400, 'Invalid user ID')
    static UserNotExist = new ApiError(404, 'User does not exist')
    static InvalidItemId = new ApiError(400, 'Invalid item ID')
    static ItemNotExist = new ApiError(404, 'Item does not exist')
    static InvalidTransactionId = new ApiError(400, 'Invalid transaction ID')
    static TransactionNotExist = new ApiError(404, 'Transaction does not exist')
    static InvalidUrl = new ApiError(400, 'URL is invalid')

    // Authorization
    static Unauthorized = new ApiError(401, 'Unauthorized')
    static ExpiredToken = new ApiError(401, 'Token is expired')
    static InvalidToken = new ApiError(
        401,
        'Token is invalid, generate a new one'
    )
    static BeforeNbf = new ApiError(401, 'Token cannot be used yet')
    static NoPermission = new ApiError(
        403,
        'No permission to access this service'
    )

    // Gamma
    static GammaToken = new ApiError(
        502,
        'Failed to get token from Gamma, your authorization code may be invalid'
    )
    static InvalidGammaResponse = new ApiError(
        502,
        'Received an invalid response from Gamma'
    )
    static UnreachableGamma = new ApiError(504, 'Unable to reach Gamma')
    static FailedGetGroups = new ApiError(502, 'Failed to get groups for user')
    static FailedGetGroupUsers = new ApiError(
        502,
        'Failed to get users for group'
    )

    // Login
    static NoAuthorizationCode = new ApiError(
        401,
        'No authorization code provided'
    )
    static AuthorizationCodeUsed = new ApiError(
        401,
        'Authorization code has already been used'
    )

    // Create purchase
    static PurchaseItemCount = new ApiError(
        400,
        'Item count must be an integer greater than 0'
    )
    static PurchaseNothing = new ApiError(
        400,
        'Must purchase at least one item'
    )
    static PurchaseInvisible = new ApiError(
        403,
        'Cannot purchase a non-visible item'
    )
    static InvalidComment = new ApiError(
        400,
        'Comment must not be longer than 1000 characters'
    )

    // Create deposit
    static InvalidTotal = new ApiError(400, 'Total must be a number')

    // Create stock update
    static StockItemCount = new ApiError(
        400,
        'Item quantity must be an integer'
    )
    static StockNothing = new ApiError(
        400,
        'Must update the stock of at least one item'
    )

    // Delete transaction
    static NoDeleteTransaction = new ApiError(
        405,
        "Transactions cannot be deleted, please use PATCH and the 'removed' flag"
    )

    // List purchase
    static InvalidLimit = new ApiError(
        400,
        'Limit must be an integer between 1 and 100'
    )
    static InvalidOffset = new ApiError(
        400,
        'Offset must be a positive integer'
    )

    // Create/modify Item
    static DisplayNameNotUnique = new ApiError(
        403,
        'Display name is not unique'
    )
    static MissingPrices = new ApiError(
        400,
        'An item must have at least one price'
    )

    // List items
    static UnknownSortMode = new ApiError(400, 'Unknown sort order')
    // #endregion Static errors
}

// #region Parameterized Errors
export function missingRequiredPropertyError(
    name: string,
    location: Location
): ApiError {
    return new ApiError(
        400,
        `Missing required property '${name}' in ${location}`
    )
}

export function invalidPropertyError(
    name: string,
    location: Location
): ApiError {
    return new ApiError(400, `Property '${name}' is invalid in ${location}`)
}

export function unexpectedErrorPleaseReport(details: string): ApiError {
    return new ApiError(
        500,
        `An unexpected issue occured. Please create an issue on GitHub at https://github.com/olillin/strecklista-backend/issues/new?template=api-bug-report.md. Details: ${details}`
    )
}

export function tokenSignError(details: string): ApiError {
    return new ApiError(500, `Failed to sign JWT: ${details}`)
}
// #endregion Parameterized Errors
