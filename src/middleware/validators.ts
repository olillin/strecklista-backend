import { body, Meta, oneOf, param, query } from 'express-validator'
import { database } from '../config/clients'
import { verifyToken } from './validateToken'
import { ApiError } from '../errors'

//#region Util
function getGroupId(meta: Meta): number {
    const auth = meta.req.headers?.authorization
    const token = auth.split(' ')[1]
    const jwt = verifyToken(token)
    const { groupId } = jwt
    return groupId
}
//#endregion Util

//#region Custom validators
/** Checks that there exists a user with the id in `value` in the same group as the user making the request. */
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
    const groupId = getGroupId(meta)
    const exists = await database.userExistsInGroup(userId, groupId)
    if (!exists) {
        throw ApiError.UserNotExist
    }
}

export async function checkItemExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = getGroupId(meta)
    const exists = await database.itemExistsInGroup(parseInt(value), groupId)
    if (!exists) {
        throw ApiError.ItemNotExist
    }
}

export async function checkTransactionExistsInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = getGroupId(meta)
    const exists = await database.transactionExistsInGroup(
        parseInt(value),
        groupId
    )
    if (!exists) {
        throw ApiError.TransactionNotExist
    }
}

export async function checkItemVisible(value: string): Promise<void> {
    // Get id
    let id: number
    try {
        id = parseInt(value)
    } catch {
        throw ApiError.InvalidItemId
    }

    // Check if visible
    const visible = await database.isItemVisible(id)
    if (!visible) {
        throw ApiError.PurchaseInvisible
    }
}

export async function checkDisplayNameUniqueInGroup(
    value: string,
    meta: Meta
): Promise<void> {
    const groupId = getGroupId(meta)
    const nameExists = await database.itemNameExistsInGroup(value, groupId)
    if (nameExists) {
        throw ApiError.DisplayNameNotUnique
    }
}
//#endregion Custom validators

// Validation chains
export const login = () => [
    oneOf([
        query('code').exists().withMessage(ApiError.NoAuthorizationCode),
        body('code').exists().withMessage(ApiError.NoAuthorizationCode),
    ]),
]

export const getUser = () => []

export const getGroup = () => []

export const getTransactions = () => [
    query('limit')
        .default(50)
        .isInt({ min: 1, max: 100 })
        .withMessage(ApiError.InvalidLimit),
    query('offset')
        .default(0)
        .isInt({ min: 0 })
        .withMessage(ApiError.InvalidOffset),
]

export const getTransaction = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidTransactionId)
        .bail()
        .custom(checkTransactionExistsInGroup)
        .withMessage(ApiError.TransactionNotExist),
]

export const patchTransaction = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidTransactionId)
        .bail()
        .custom(checkTransactionExistsInGroup)
        .withMessage(ApiError.TransactionNotExist),
    body('removed').optional().isBoolean({ strict: true }),
]

export const postPurchase = () => [
    body('userId')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidUserId)
        .bail()
        .custom(checkUserExistsInGroup)
        .withMessage(ApiError.UserNotExist),
    body('items')
        .exists()
        .isArray({ min: 1 })
        .withMessage(ApiError.PurchaseNothing),
    body('items.*.id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup)
        .withMessage(ApiError.ItemNotExist)
        .bail()
        .custom(checkItemVisible)
        .withMessage(ApiError.PurchaseInvisible),
    body('items.*.quantity')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.PurchaseItemCount),
    body('items.*.purchasePrice').exists().isObject(),
    body('items.*.purchasePrice.price').exists().isDecimal(),
    body('items.*.purchasePrice.displayName').exists().isString().trim(),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(ApiError.InvalidComment),
]

export const postDeposit = () => [
    body('userId')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidUserId)
        .bail()
        .custom(checkUserExistsInGroup)
        .withMessage(ApiError.UserNotExist),
    body('total').exists().isDecimal().withMessage(ApiError.InvalidTotal),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(ApiError.InvalidComment),
]

export const postStockUpdate = () => [
    body('items')
        .exists()
        .isArray({ min: 1 })
        .withMessage(ApiError.StockNothing),
    body('items.*.id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup)
        .withMessage(ApiError.ItemNotExist),
    body('items.*.quantity')
        .exists()
        .isInt()
        .withMessage(ApiError.StockItemCount),
    body('items.*.absolute').optional().isBoolean(),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(ApiError.InvalidComment),
]

export const itemSortModes = <const>[
    'popular',
    'cheap',
    'expensive',
    'new',
    'old',
    'name_a2z',
    'name_z2a',
    'high_stock',
    'low_stock',
]
export const getItems = () => [
    query('sort')
        .default('popular')
        .isString()
        .trim()
        .isIn(itemSortModes)
        .withMessage(ApiError.UnknownSortMode),
    query('visibleOnly').default(true).isBoolean(),
]

export const postItem = () => [
    body('displayName')
        .exists()
        .isString()
        .bail()
        .trim()
        .notEmpty()
        .bail()
        .custom(checkDisplayNameUniqueInGroup)
        .withMessage(ApiError.DisplayNameNotUnique),
    body('prices')
        .exists()
        .isArray({ min: 1 })
        .withMessage(ApiError.MissingPrices),
    body('prices.*.price').exists().isDecimal(),
    body('prices.*.displayName').exists().isString().bail().trim().notEmpty(),
    body('icon').optional().isURL(),
]

export const getItem = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup)
        .withMessage(ApiError.ItemNotExist),
]

export const patchItem = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup)
        .withMessage(ApiError.ItemNotExist),
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
    body('displayName')
        .optional()
        .isString()
        .trim()
        .custom(checkDisplayNameUniqueInGroup)
        .withMessage(ApiError.DisplayNameNotUnique),
    body('prices')
        .optional()
        .isArray({ min: 1 })
        .withMessage(ApiError.MissingPrices),
    body('prices.*.price').isDecimal(),
    body('prices.*.displayName').isString().trim().notEmpty(),
    body('visible').optional().isBoolean(),
    body('favorite').optional().isBoolean(),
]

export const deleteItem = () => [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage(ApiError.InvalidItemId)
        .bail()
        .custom(checkItemExistsInGroup)
        .withMessage(ApiError.ItemNotExist),
]
