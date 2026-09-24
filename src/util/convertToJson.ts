import { Decimal } from '@prisma/client/runtime/client'

/** Mapped type that replaces all instances of X with Y in T. */
export type ReplaceProperties<T, X, Y> = T extends X
    ? Y
    : T extends object
      ? {
            [Property in keyof T]: ReplaceProperties<T[Property], X, Y>
        }
      : T

/** Mapped type that replaces all instances of Decimal with number. */
export type DecimalToNumber<T> = ReplaceProperties<T, Decimal, number>

/** Mapped type that replaces all instances of Date with number. */
export type DateToNumber<T> = ReplaceProperties<T, Date, number>

export type ToJSON<T> = DateToNumber<DecimalToNumber<T>>

/**
 * Convert an object to a JSON compatible format.
 *
 * Decimal objects are converted to number.
 * Date objects are converted to the timestamp in ms.
 *
 * @param value The object to convert.
 * @returns The same object with types replaced as described above.
 */
export function convertToJson<T>(value: T): ToJSON<T> {
    if (value instanceof Decimal) {
        /* @ts-expect-error T is Decimal, TypeScript is unable to infer the return type. */
        return value.toNumber()
    } else if (value instanceof Date) {
        /* @ts-expect-error T is Date, TypeScript is unable to infer the return type. */
        return (value as Date).valueOf()
    } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
            /* @ts-expect-error T is array, TypeScript is unable to infer the return type. */
            return value.map(x => convertToJson(x))
        } else {
            /* @ts-expect-error T is object, TypeScript is unable to infer the return type. */
            const entries = Object.entries(value).map(([key, value]) => {
                return [key, convertToJson(value)]
            })
            return Object.fromEntries(entries)
        }
    } else {
        /* @ts-expect-error T is a type which is not affected by ToJSON<T>, TypeScript is unable to infer the return type. */
        return value
    }
}
