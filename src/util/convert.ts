import {
    Deposit,
    Group,
    Item,
    ItemStockUpdate,
    JWT,
    LoginResponse,
    Purchase,
    PurchasedItem,
    StockUpdate,
    Transaction,
    TransactionType,
    User,
    UserResponse,
} from '../types'
import * as gamma from 'gammait'
import {groupAvatarUrl, userAvatarUrl} from 'gammait/urls'
import {getFlag, parseTransactionFlags, ItemFlags} from "../flags";

export function splitFullItemWithPrices(
    fullItemWithPrices: tableType.FullItemWithPrices[]
): [tableType.FullItem, tableType.Prices[], boolean] {
    if (fullItemWithPrices.length === 0) {
        throw new Error('Item is empty')
    }

    const item: tableType.FullItem = {
        id: fullItemWithPrices[0].id,
        group_id: fullItemWithPrices[0].group_id,
        display_name: fullItemWithPrices[0].display_name,
        icon_url: fullItemWithPrices[0].icon_url,
        created_time: fullItemWithPrices[0].created_time,
        flags: fullItemWithPrices[0].flags,
        stock: fullItemWithPrices[0].stock,
        times_purchased: fullItemWithPrices[0].times_purchased,
    }
    const prices: tableType.Prices[] = fullItemWithPrices.map(
        fullItemWithPrice => ({
            item_id: fullItemWithPrice.id,
            price: fullItemWithPrice.price,
            display_name: fullItemWithPrice.price_display_name,
        })
    )
    const isFavorite = fullItemWithPrices[0].favorite

    return [item, prices, isFavorite]
}

export function toItem(
    item: tableType.FullItem,
    prices: tableType.Prices[],
    favorite: boolean
): Item
export function toItem(item: tableType.FullItemWithPrices[]): Item
export function toItem(
    a: tableType.FullItem | tableType.FullItemWithPrices[],
    b?: tableType.Prices[],
    c?: boolean
): Item {
    let fullItem: tableType.FullItem
    let prices: tableType.Prices[]
    let favorite: boolean
    if (b === undefined || c === undefined) {
        ;[fullItem, prices, favorite] = splitFullItemWithPrices(
            a as FullItemWithPrices[]
        )
    } else {
        fullItem = a as tableType.FullItem
        prices = b
        favorite = c
    }

    return {
        id: fullItem.id,
        createdTime: fullItem.created_time.getTime(),
        displayName: fullItem.display_name,
        prices: prices.map(price => ({
            price: price.price,
            displayName: price.display_name,
        })),
        stock: fullItem.stock,
        timesPurchased: fullItem.times_purchased,
        visible: !getFlag(fullItem.flags, ItemFlags.INVISIBLE),
        favorite: favorite,
        ...(!!fullItem.icon_url && { icon: fullItem.icon_url }),
    }
}

type GammaUser = gamma.User | gamma.UserInfo
function isUserInfo(gammaUser: GammaUser): gammaUser is gamma.UserInfo {
    return 'sub' in gammaUser
}
export function toUser(
    dbUser: tableType.FullUser,
    gammaUser: gamma.User | gamma.UserInfo | null
): User {
    const names =
        gammaUser === null
            ? {
                  nick: 'N/A',
                  firstName: 'N/A',
                  lastName: 'N/A',
              }
            : isUserInfo(gammaUser)
            ? {
                  nick: gammaUser.nickname,
                  firstName: gammaUser.given_name,
                  lastName: gammaUser.family_name,
              }
            : {
                  nick: gammaUser.nick,
                  firstName: gammaUser.firstName,
                  lastName: gammaUser.lastName,
              }

    return {
        id: dbUser.id,
        gammaId: dbUser.gamma_id,
        balance: dbUser.balance,
        avatarUrl: userAvatarUrl(dbUser.gamma_id),
        ...names,
    }
}

export function toGroup(
    dbGroup: tableType.Groups,
    gammaGroup: gamma.Group | gamma.GroupWithPost
): Group {
    return {
        id: dbGroup.id,
        gammaId: dbGroup.gamma_id,
        avatarUrl: groupAvatarUrl(dbGroup.gamma_id),
        prettyName: gammaGroup.prettyName,
    }
}

export function toUserResponse(
    dbUser: tableType.FullUser,
    gammaUser: GammaUser,
    gammaGroup: gamma.Group
): UserResponse {
    const dbGroup: tableType.Groups = {
        id: dbUser.group_id,
        gamma_id: dbUser.group_gamma_id,
    }
    return {
        user: toUser(dbUser, gammaUser),
        group: toGroup(dbGroup, gammaGroup),
    }
}

export function toLoginResponse(
    dbUser: tableType.FullUser,
    gammaUser: GammaUser,
    gammaGroup: gamma.Group,
    token: JWT
): LoginResponse {
    return {
        access_token: token.access_token,
        token_type: 'Bearer',
        expires_in: token.expires_in,
        ...toUserResponse(dbUser, gammaUser, gammaGroup),
    }
}

export function toTransaction<T extends TransactionType>(
    dbTransaction: tableType.Transactions,
    type: T
): Transaction<T> {
    return {
        type,
        id: dbTransaction.id,
        createdBy: dbTransaction.created_by,
        createdTime: dbTransaction.created_time.getTime(),
        ...getTransactionFlags(dbTransaction.flags),
        ...(!!dbTransaction.comment &&
            dbTransaction.comment.length > 0 && {
                comment: dbTransaction.comment,
            }),
    }
}

export function toPurchasedItem(
    dbPurchasedItem: tableType.PurchasedItems | tableType.FullPurchases
): PurchasedItem {
    return {
        item: {
            displayName: dbPurchasedItem.display_name,
            ...(!!dbPurchasedItem.item_id && { id: dbPurchasedItem.item_id }),
            ...(!!dbPurchasedItem.icon_url && {
                icon: dbPurchasedItem.icon_url,
            }),
        },
        quantity: dbPurchasedItem.quantity,
        purchasePrice: {
            price: dbPurchasedItem.purchase_price,
            displayName: dbPurchasedItem.purchase_price_name,
        },
    }
}

export function toPurchase(dbPurchase: tableType.FullPurchases[]): Purchase {
    return {
        items: dbPurchase.map(toPurchasedItem),
        createdFor: dbPurchase[0].created_for,
        ...toTransaction(dbPurchase[0], 'purchase'),
    }
}

export function toDeposit(dbDeposit: tableType.Deposits): Deposit {
    return {
        total: dbDeposit.total,
        createdFor: dbDeposit.created_for,
        ...toTransaction(dbDeposit, 'deposit'),
    }
}

export function toItemStockUpdate(dbItemStockUpdate: tableType.ItemStockUpdates | tableType.FullStockUpdates): ItemStockUpdate {
    return {
        id: dbItemStockUpdate.item_id,
        before: dbItemStockUpdate.before,
        after: dbItemStockUpdate.after,
    }
}

export function toStockUpdate(dbStockUpdate: tableType.FullStockUpdates[]): StockUpdate {
    return {
        items: dbStockUpdate.map(toItemStockUpdate),
       ...toTransaction(dbStockUpdate[0], 'stockUpdate')
    }
}
