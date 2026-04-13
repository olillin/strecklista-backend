import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'
import crypto from 'crypto'
import { toBase32hex } from '@exodus/bytes/base32.js'
import {
    getCompleteAuthorizedGroup,
    getCompleteUser,
    Group,
    UserProfile,
} from './gammaService'

export interface OfflineClient {
    id: string
    scopes: Scope[]
    group: Group
    owner: UserProfile
    displayName: string
    description?: string
}

export interface OfflineClientWithSecret extends OfflineClient {
    secret: string
}

export const supportedScopes = [
    'transactions',
    'transactions:write',
    'items',
    'items:write',
    'group',
] as const
export type Scope = (typeof supportedScopes)[number]

/**
 * Check if a string is a valid scope.
 * @param maybeScope The string to check.
 * @returns If the scope is in the list of valid scopes.
 */
export function isScope(maybeScope: string): maybeScope is Scope {
    return (supportedScopes as readonly string[]).includes(maybeScope)
}

/**
 * Parse a string of scopes.
 * @param scopes String containing scopes separated by a single space.
 * @returns The parsed list of scopes.
 * @throws If any scope is invalid.
 */
export function parseScopes(scopes: string): Scope[] {
    const splitScopes = scopes.split(' ')
    splitScopes.forEach(scope => {
        if (!isScope(scope)) {
            throw new Error(`Unable to parse unknown scope '${scope}'`)
        }
    })
    return splitScopes as Scope[]
}

/**
 * Generate a random secret of a set length of bytes.
 * @returns The generated secret.
 */
function randomSecret(length: number): string {
    return toBase32hex(crypto.randomBytes(length))
}

async function hashSecret(
    secret: string,
    salt: Buffer<ArrayBufferLike>
): Promise<string> {
    return new Promise((resolve, reject) => {
        return crypto.argon2(
            'argon2id',
            {
                message: secret,
                nonce: salt,
                parallelism: 1,
                tagLength: 64,
                memory: 19456, // 19 MiB
                passes: 2,
            },
            (err, derivedKey) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(toBase32hex(derivedKey))
                }
            }
        )
    })
}

export async function createClient(
    groupId: number,
    ownerId: number,
    scopes: Scope[],
    displayName: string,
    description?: string | null
): Promise<OfflineClientWithSecret> {
    const secret = randomSecret(32)
    const salt = crypto.randomBytes(16)

    const storedSecret = await hashSecret(secret, salt)
    const storedSalt = toBase32hex(salt)
    console.log(`Salt: ${storedSalt} (${storedSalt.length})`)
    const storedScopes = scopes.join(' ')

    return prisma.apiClient
        .create({
            data: {
                // Store the hashed secret
                secret: storedSecret,
                salt: storedSalt,
                scopes: storedScopes,
                ownerId,
                groupId,
                displayName,
                description: description ?? Prisma.skip,
            },
        })
        .then(async client => {
            const user = await getCompleteUser(client.ownerId, client.groupId)
            if (user == null) {
                throw Error('Unable to get user during API client creation')
            }
            const group = await getCompleteAuthorizedGroup(
                client.groupId,
                user.gammaId
            )
            if (group == null) {
                throw Error('Unable to get group during API client creation')
            }

            return {
                // Send the actual secret just this once
                secret: secret,
                id: client.id,
                scopes: parseScopes(client.scopes),
                group: group,
                owner: {
                    id: user.id,
                    gammaId: user.gammaId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    nick: user.nick,
                    avatarUrl: user.avatarUrl,
                },
                displayName: client.displayName,
                ...(client.description == null
                    ? {}
                    : { description: client.description }),
            } satisfies OfflineClientWithSecret
        })
}

export async function clientNameExistsInGroup(
    name: string,
    groupId: number
): Promise<boolean> {
    return prisma.apiClient
        .findFirst({
            where: {
                displayName: name,
                groupId: groupId,
            },
        })
        .then(client => client !== null)
}
