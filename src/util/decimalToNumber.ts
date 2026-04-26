import { Decimal } from '@prisma/client/runtime/client'

/** Mapped type that replaces all instances of Decimal with number. */
export type DecimalToNumber<Type> = Type extends Decimal
    ? number
    : Type extends object
      ? {
            [Property in keyof Type]: DecimalToNumber<Type[Property]>
        }
      : Type

export function convertDecimalToNumber<T>(value: T): DecimalToNumber<T> {
    if (value instanceof Decimal) {
        /* @ts-expect-error */
        return value.toNumber()
    } else if (typeof value === 'object' && value != null) {
        if (Array.isArray(value)) {
            /* @ts-expect-error */
            return value.map(x => convertDecimalToNumber(x))
        } else {
            const entries = Object.entries(value).map(([key, value]) => {
                return [key, convertDecimalToNumber(value)]
            })
            return Object.fromEntries(entries)
        }
    } else {
        /* @ts-expect-error */
        return value
    }
}
