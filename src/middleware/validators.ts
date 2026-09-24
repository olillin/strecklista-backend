import {
    body,
    header,
    type Meta,
    oneOf,
    param,
    query,
    type ValidationChain,
    type ContextRunner,
    checkExact,
    check,
} from 'express-validator'
import { getGroupId, verifyToken } from '@/lib/token.js'
import {
    ApiError,
    invalidPropertyError,
    sendError,
    unsupportedScopeError,
    type ErrorResolvable,
} from '@/lib/errors.js'
import { isExternalUserInGroup, isUserInGroup } from '@/services/userService.js'
import * as userService from '@/services/userService.js'
import {
    externalItemExistsInGroup,
    isExternalItemVisible,
    isItemVisible,
    itemExistsInGroup,
    itemNameExistsInGroup,
} from '@/services/itemService.js'
import * as itemService from '@/services/itemService.js'
import { transactionExistsInGroup } from '@/services/transactionService.js'
import {
    CLIENT_ID_LENGTH,
    clientExistsInGroup,
    isGroupClientNameTaken,
    isScope,
} from '@/services/clientService.js'
import { acceptedGrantTypes, type GrantType } from '@/lib/token.js'
import type {
    CustomValidator,
    Middleware,
    Request,
} from 'express-validator/lib/base.js'

/**
 * Get the group of a request.
 * @param meta The metadata about the request.
 * @throws If the metadata does not contain a group id.
 * @returns The group id as a number.
 */
function requireGroupId(meta: Meta): number {
    const auth = meta.req.headers?.authorization
    const token = auth.split(' ')[1]
    const jwt = verifyToken(token)
    const groupId: number | null = getGroupId(jwt)
    if (groupId == null) throw ApiError.Unauthorized
    return groupId
}

//#region Custom validators
/**
 * Checks that there exists a user with the id in `value` in the same group as
 * the user making the request.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a user does not exist.
 * @throws If the user id is invalid.
 * @throws If the metadata does not contain a group id.
 */
export async function checkUserExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    // Get user ID
    let userId: number
    try {
        userId = parseInt(value)
    } catch {
        throw ApiError.InvalidUserId
    }

    // Check if user exists
    const groupId = requireGroupId(meta)
    const exists = await isUserInGroup(userId, groupId)
    if (!exists) {
        throw ApiError.UserNotExist
    }
}

/**
 * Checks that there exists a user with the external id in `value` in the same
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a user does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkExternalUserExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    // Check if user exists
    const groupId = requireGroupId(meta)
    const exists = await isExternalUserInGroup(value, groupId)
    if (!exists) {
        throw ApiError.UserNotExist
    }
}

/**
 * Checks that there does not exist a user with the external id in `value` in
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a user exists.
 * @throws If the metadata does not contain a group id.
 */
export async function checkExternalUserUniqueInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)

    // Check if the user already has the external id
    const userId = meta.req.params?.id as unknown
    if (typeof userId === 'string') {
        let parsedUserId: number
        try {
            parsedUserId = parseInt(userId)
        } catch {
            throw ApiError.InvalidUserId
        }
        const user = await userService.getOfflineGroupUser(
            parsedUserId,
            groupId
        )

        if (user && user.externalId != undefined && user.externalId === value) {
            // User already has the external id
            return
        }
    }

    // Check if other user exists with the external id
    const exists = await isExternalUserInGroup(value, groupId)
    if (exists) {
        throw ApiError.ExternalIdNotUnique
    }
}

/**
 * Checks that there exists an item with the id in `value` in
 * the group of the requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such an item does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkItemExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    let itemId: number
    try {
        itemId = parseInt(value)
    } catch {
        throw ApiError.InvalidItemId
    }
    const groupId = requireGroupId(meta)
    const exists = await itemExistsInGroup(itemId, groupId)
    if (!exists) {
        throw ApiError.ItemNotExist
    }
}

/**
 * Checks that there exists an item with the external id in `value` in the same
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such an item does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkExternalItemExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)
    const exists = await externalItemExistsInGroup(value, groupId)
    if (!exists) {
        throw ApiError.ItemNotExist
    }
}

/**
 * Checks that there exists a visible item with the external id in `value` in
 * the same the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such an item does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkExternalItemVisible(
    value: string,
    meta: Meta
): Promise<void> {
    // Check if visible
    const groupId = requireGroupId(meta)
    const visible = await isExternalItemVisible(value, groupId)
    if (!visible) {
        throw ApiError.PurchaseInvisible
    }
}

/**
 * Checks that there does not exist a price with the external id in `value` in
 * the group of requester.
 *
 * Conflicts within the same item are ignored, to accomplish this the 'id' param
 * is read.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a price exists.
 * @throws If the metadata contains an invalid item 'id' param.
 * @throws If the metadata does not contain a group id.
 */
export async function checkPriceExternalIdUnique(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)

    // Allow if external id refers to this item
    const itemId = meta.req.params?.id as unknown
    if (typeof itemId === 'string') {
        let parsedItemId: number
        try {
            parsedItemId = parseInt(itemId)
        } catch {
            throw ApiError.InvalidItemId
        }
        const item = await itemService.getItem(parsedItemId)
        const hasPrice =
            item !== undefined &&
            item?.prices.find(
                price =>
                    price.externalId != undefined && price.externalId === value
            ) !== undefined
        if (hasPrice) {
            // Skip validator
            return
        }
    }

    const exists = await externalItemExistsInGroup(value, groupId)
    if (exists) {
        throw ApiError.ExternalIdNotUnique
    }
}

/**
 * Checks that the external price IDs are unique within the request body.
 * @returns A middleware which sends an error if there exists duplicate external IDs or if any external ID is invalid.
 */
export function checkPricesExternalIdsInternallyUnique(): Middleware {
    const run = (req: Request): void => {
        const prices = req.body.prices as unknown
        if (prices === undefined) return
        if (!Array.isArray(prices)) throw invalidPropertyError('prices', 'body')

        const externalIds = prices
            .map(price => {
                const externalId = price.externalId as unknown
                if (externalId != undefined && typeof externalId !== 'string') {
                    throw ApiError.InvalidExternalId
                }
                return externalId
            })
            .filter(externalId => externalId != undefined)

        if (new Set(externalIds).size !== externalIds.length) {
            throw ApiError.ExternalIdNotUnique
        }
    }

    const middleware: Middleware = (req, res, next) => {
        try {
            run(req)
            next()
        } catch (error: unknown) {
            sendError(res, error as ErrorResolvable)
        }
    }
    return middleware
}

/**
 * Checks that there exists a transaction with the id in `value` in
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a transaction does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkTransactionExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)
    const exists = await transactionExistsInGroup(parseInt(value), groupId)
    if (!exists) {
        throw ApiError.TransactionNotExist
    }
}

/**
 * Checks that there exists a visible item with the id in `value` in the same
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If value is an invalid item id.
 * @throws If such an item does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkItemVisible(value: string): Promise<void> {
    // Get id
    let id: number
    try {
        id = parseInt(value)
    } catch {
        throw ApiError.InvalidItemId
    }

    // Check if visible
    const visible = await isItemVisible(id)
    if (!visible) {
        throw ApiError.PurchaseInvisible
    }
}

/**
 * Checks that there does not exist an item with the display name in `value` in
 * the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If value is an invalid item id.
 * @throws If such an item exists.
 * @throws If the metadata does not contain a group id.
 */
export async function checkItemDisplayNameUniqueInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)

    // Check if item already has the display name
    const itemId = meta.req.params?.id as unknown
    if (typeof itemId === 'string') {
        let parsedItemId: number
        try {
            parsedItemId = parseInt(itemId)
        } catch {
            throw ApiError.InvalidItemId
        }
        const item = await itemService.getItem(parsedItemId)

        if (item && item.displayName === value) {
            // Item already has the display name
            return
        }
    }

    const nameExists = await itemNameExistsInGroup(value, groupId)
    if (nameExists) {
        throw ApiError.DisplayNameNotUnique
    }
}

/**
 * Checks that there exists a group client with the id in `value` in the group
 * of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a group client does not exist.
 * @throws If the metadata does not contain a group id.
 */
export async function checkClientExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)
    const exists = await clientExistsInGroup(value, groupId)
    if (!exists) {
        throw ApiError.ClientNotExist
    }
}

/**
 * Checks that the value is in the list of supported scopes.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If the scope is unsupported.
 */
export async function checkValidScope(value: string): Promise<void> {
    const scopes = value.split(' ')
    const unsupportedScopes = scopes.filter(scope => !isScope(scope))

    if (unsupportedScopes.length > 0) {
        throw unsupportedScopeError(unsupportedScopes.join(' '))
    }
}

/**
 * Checks that there does not exist a group client with the display name in
 * `value` in the group of requester.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If such a group client exists.
 * @throws If the metadata does not contain a group id.
 */
export async function checkClientDisplayNameUniqueInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = requireGroupId(meta)
    const nameExists = await isGroupClientNameTaken(value, groupId)
    if (nameExists) {
        throw ApiError.DisplayNameNotUnique
    }
}

/**
 * Checks that the value is in the list of supported grant types.
 *
 * @param value The value to check.
 * @param meta Metadata about the request.
 * @throws If the grant type is unsupported.
 */
export async function checkSupportedGrantType(value: string): Promise<void> {
    if (!(acceptedGrantTypes as readonly string[]).includes(value)) {
        throw ApiError.UnsupportedGrantType
    }
}
//#endregion Custom validators

// Validation chains

function when(
    condition: CustomValidator | ContextRunner,
    builder: (checks: {
        body: (field: string) => ValidationChain
        param: (field: string) => ValidationChain
        query: (field: string) => ValidationChain
    }) => (ValidationChain | Middleware)[]
): (ValidationChain | Middleware)[] {
    return builder({
        body: field => body(field).if(condition),
        param: field => param(field).if(condition),
        query: field => query(field).if(condition),
    })
}

function grantTypeEquals(type: GrantType) {
    return body('grant_type').equals(type)
}

export const token = () => [
    body('grant_type').exists().isString().custom(checkSupportedGrantType),
    // Authorization code
    ...when(grantTypeEquals('authorization_code'), ({ body }) => [
        body('code').exists().withMessage(ApiError.NoAuthorizationCode),
    ]),
    // Client credentials
    ...when(grantTypeEquals('client_credentials'), ({ body }) => [
        oneOf([
            [
                header('Authorization')
                    .if(grantTypeEquals('client_credentials'))
                    .isString()
                    .matches(/^Basic [A-Za-z0-9+/]+={0,3}$/),
            ],
            [
                body('client_id')
                    .exists()
                    .isString()
                    .withMessage(ApiError.InvalidClientId)
                    .isLength({ min: CLIENT_ID_LENGTH, max: CLIENT_ID_LENGTH })
                    .withMessage(ApiError.InvalidClientId),
                body('client_secret').exists().isString(),
            ],
        ]),
    ]),
]

export const getUser = () => []

export const getGroup = () => []

export const getGroupMember = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidUserId)
        .bail()
        .custom(checkUserExistsInGroup),
]

export const putGroupMember = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidUserId)
        .bail()
        .custom(checkUserExistsInGroup),
    checkExact([
        body('externalId')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidExternalId)
            .isLength({ max: 100 })
            .withMessage(ApiError.InvalidExternalId)
            .bail()
            .custom(checkExternalUserUniqueInGroup),
    ]),
]

export const getGroupMemberByExternal = () => [
    param('externalId')
        .exists()
        .isString()
        .withMessage(ApiError.InvalidExternalId)
        .isLength({ max: 100 })
        .withMessage(ApiError.InvalidExternalId)
        .bail()
        .custom(checkExternalUserExistsInGroup),
]

export const getTransactionList = () => [
    checkExact([
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage(ApiError.InvalidLimit),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage(ApiError.InvalidOffset),
        query('createdBy')
            .optional()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidUserId)
            .bail()
            .custom(checkUserExistsInGroup),
        query('createdFor')
            .optional()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidUserId)
            .bail()
            .custom(checkUserExistsInGroup),
    ]),
]

export const getTransaction = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidTransactionId)
        .bail()
        .custom(checkTransactionExistsInGroup),
]

export const patchTransaction = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidTransactionId)
        .bail()
        .custom(checkTransactionExistsInGroup),
    checkExact([body('removed').optional().isBoolean({ strict: true })]),
]

export const postPurchase = () => [
    body('items')
        .exists()
        .isArray({ min: 1 })
        .withMessage(ApiError.PurchaseNothing),
    body('comment')
        .optional()
        .isString()
        .withMessage(ApiError.InvalidComment)
        .trim()
        .isLength({ max: 1000 })
        .withMessage(ApiError.InvalidComment),
    oneOf([body('userId').exists(), body('externalUserId').exists()]),
    ...when(body('userId').exists(), ({ body }) => [
        body('externalUserId')
            .not()
            .exists()
            .withMessage(ApiError.PurchaseDoubleUserId),
        body('userId')
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidUserId)
            .not()
            .isString()
            .withMessage(ApiError.InvalidUserId)
            .bail()
            .custom(checkUserExistsInGroup),
    ]),
    body('externalUserId')
        .if(body('externalUserId').exists())
        .isString()
        .withMessage(ApiError.InvalidExternalId)
        .isLength({ max: 100 })
        .withMessage(ApiError.InvalidExternalId)
        .bail()
        .custom(checkExternalUserExistsInGroup),
    body('items.*.quantity')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.PurchaseItemCount)
        .not()
        .isString()
        .withMessage(ApiError.PurchaseItemCount),
    oneOf([body('items.*.id').exists(), body('items.*.externalId').exists()]),
    ...when(body('items.*.id').exists(), ({ body }) => [
        body('items.*.externalId')
            .not()
            .exists()
            .withMessage(ApiError.PurchaseDoubleItemId),
        body('items.*.id')
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidItemId)
            .not()
            .isString()
            .withMessage(ApiError.InvalidItemId)
            .bail()
            .custom(checkItemExistsInGroup)
            .bail()
            .custom(checkItemVisible)
            .withMessage(ApiError.PurchaseInvisible),
        body('items.*.purchasePrice').exists().isObject(),
        body('items.*.purchasePrice.price').exists().isDecimal(),
        body('items.*.purchasePrice.displayName').exists().isString().trim(),
    ]),
    ...when(body('items.*.externalId').exists(), ({ body }) => [
        body('items.*.externalId')
            .isString()
            .withMessage(ApiError.InvalidExternalId)
            .isLength({ max: 100 })
            .withMessage(ApiError.InvalidExternalId)
            .bail()
            .custom(checkExternalItemExistsInGroup)
            .bail()
            .custom(checkExternalItemVisible)
            .withMessage(ApiError.PurchaseInvisible),
        body('items.*.purchasePrice')
            .not()
            .exists()
            .withMessage(ApiError.PurchaseExternalWithPrice),
    ]),
]

export const postDeposit = () => [
    checkExact([
        body('userId')
            .exists()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidUserId)
            .not()
            .isString()
            .withMessage(ApiError.InvalidUserId)
            .bail()
            .custom(checkUserExistsInGroup),
        body('total').exists().isDecimal().withMessage(ApiError.InvalidTotal),
        body('comment')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidComment)
            .trim()
            .isLength({ max: 1000 })
            .withMessage(ApiError.InvalidComment),
    ]),
]

export const postStockUpdate = () => [
    checkExact([
        body('items')
            .exists()
            .isArray({ min: 1 })
            .withMessage(ApiError.StockNothing),
        body('items.*.id')
            .exists()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidItemId)
            .not()
            .isString()
            .withMessage(ApiError.InvalidItemId)
            .bail()
            .custom(checkItemExistsInGroup),
        body('items.*.quantity')
            .exists()
            .isInt()
            .withMessage(ApiError.StockItemCount)
            .not()
            .isString()
            .withMessage(ApiError.StockItemCount),
        body('items.*.absolute').optional().isBoolean(),
        body('comment')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidComment)
            .trim()
            .isLength({ max: 1000 })
            .withMessage(ApiError.InvalidComment),
    ]),
]

export const itemSortModes = [
    'popular',
    'cheap',
    'expensive',
    'new',
    'old',
    'name_a2z',
    'name_z2a',
    'high_stock',
    'low_stock',
] as const
export type ItemSortMode = (typeof itemSortModes)[number]

export const getItemList = () => [
    checkExact([
        query('sort')
            .default('popular')
            .isString()
            .trim()
            .isIn(itemSortModes)
            .withMessage(ApiError.UnknownSortMode),
        query('visibleOnly').default(true).isBoolean(),
    ]),
]

export const postItem = () => [
    checkExact([
        body('displayName')
            .exists()
            .isString()
            .bail()
            .trim()
            .notEmpty()
            .bail()
            .custom(checkItemDisplayNameUniqueInGroup),
        body('prices')
            .exists()
            .isArray({ min: 1 })
            .withMessage(ApiError.MissingPrices),
        body('prices.*.price').exists().isDecimal(),
        body('prices.*.displayName')
            .exists()
            .isString()
            .bail()
            .trim()
            .notEmpty(),
        body('prices.*.externalId')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidExternalId)
            .isLength({ max: 100 })
            .withMessage(ApiError.InvalidExternalId)
            .bail()
            .custom(checkPriceExternalIdUnique),
        body('icon').optional().isURL(),
    ]),
    checkPricesExternalIdsInternallyUnique(),
]

export const getItem = () => [
    checkExact([
        param('id')
            .exists()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidItemId)
            .bail()
            .custom(checkItemExistsInGroup),
    ]),
]

export const patchItem = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup),
    oneOf([
        body('icon')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidUrl)
            .trim()
            .isURL()
            .withMessage(ApiError.InvalidUrl),
        body('icon').not().exists(),
    ]),
    checkExact([
        check('icon'),
        body('displayName')
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .bail()
            .custom(checkItemDisplayNameUniqueInGroup),
        body('prices')
            .optional()
            .isArray({ min: 1 })
            .withMessage(ApiError.MissingPrices),
        body('prices.*.price').isDecimal(),
        body('prices.*.displayName').isString().trim().notEmpty(),
        body('prices.*.externalId')
            .optional()
            .isString()
            .withMessage(ApiError.InvalidExternalId)
            .isLength({ max: 100 })
            .withMessage(ApiError.InvalidExternalId)
            .bail()
            .custom(checkPriceExternalIdUnique),
        body('visible').optional().isBoolean(),
    ]),
    checkPricesExternalIdsInternallyUnique(),
]

export const deleteItem = () => [
    checkExact([
        param('id')
            .exists()
            .isInt({ min: 1 })
            .withMessage(ApiError.InvalidItemId)
            .bail()
            .custom(checkItemExistsInGroup),
    ]),
]

export const getItemByExternal = () => [
    checkExact([
        param('externalId')
            .exists()
            .isString()
            .withMessage(ApiError.InvalidExternalId)
            .isLength({ max: 100 })
            .withMessage(ApiError.InvalidExternalId)
            .bail()
            .custom(checkExternalItemExistsInGroup),
    ]),
]

export const getGroupClient = () => [
    checkExact([
        param('id')
            .exists()
            .isString()
            .withMessage(ApiError.InvalidClientId)
            .isLength({ min: CLIENT_ID_LENGTH, max: CLIENT_ID_LENGTH })
            .withMessage(ApiError.InvalidClientId)
            .bail()
            .custom(checkClientExistsInGroup),
    ]),
]

export const getGroupClientList = () => []

export const postGroupClient = () => [
    checkExact([
        body('scope')
            .exists()
            .withMessage(ApiError.NoScope)
            .isString()
            .bail()
            .trim()
            .notEmpty()
            .withMessage(ApiError.NoScope)
            .bail()
            .custom(checkValidScope),
        body('displayName')
            .exists()
            .isString()
            .trim()
            .isLength({
                min: 1,
                max: 50,
            })
            .bail()
            .custom(checkClientDisplayNameUniqueInGroup),
        body('description').optional().isString().trim().isLength({
            max: 255,
        }),
    ]),
]

export const deleteGroupClient = () => [
    checkExact([
        param('id')
            .exists()
            .isString()
            .withMessage(ApiError.InvalidClientId)
            .isLength({ min: CLIENT_ID_LENGTH, max: CLIENT_ID_LENGTH })
            .withMessage(ApiError.InvalidClientId)
            .bail()
            .custom(checkClientExistsInGroup),
    ]),
]

export const getMeta = () => []
