import { Decimal } from '@prisma/client/runtime/client'

/** Mapped type that replaces all instances of Decimal with number. */
export type DecimalToNumber<Type> = Type extends Decimal
    ? number
    : Type extends Object
      ? {
            [Property in keyof Type]: DecimalToNumber<Type[Property]>
        }
      : Type

export function convertDecimalToNumber<T>(value: T): DecimalToNumber<T> {
    if (value instanceof Decimal) {
        /* @ts-ignore */
        return value.toNumber()
    } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
            /* @ts-ignore */
            return value.map(x => convertDecimalToNumber(x))
        } else {
            /* @ts-ignore */
            const entries = Object.entries(value).map(([key, value]) => {
                return [key, convertDecimalToNumber(value)]
            })
            return Object.fromEntries(entries)
        }
    } else {
        /* @ts-ignore */
        return value
    }
}
