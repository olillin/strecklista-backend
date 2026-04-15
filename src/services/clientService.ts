import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'
import crypto from 'crypto'
import { fromBase32hex, toBase32hex } from '@exodus/bytes/base32.js'
import { getGroupUser, Group, User } from './gammaService'
import { GroupId } from 'gammait'

/**
 * Clients uses ULID identifiers which are 26 characters long.
 */
export const CLIENT_ID_LENGTH = 26

export interface GroupClient {
    id: string
    scope: Scope[]
    group: Group
    owner: User
    displayName: string
    description?: string
}

export interface GroupClientDetailsWithSecretHash {
    secretHash: string
    salt: string
    id: string
    scope: string
    group: {
        id: number
        gammaId: GroupId
    }
    ownerId: number
    displayName: string
    description?: string
}

export interface GroupClientWithSecret extends GroupClient {
    secret: string
}

export const supportedScopes = [
    'transactions.read',
    'transactions.create',
    'transactions.update',
    'items.read',
    'items.create',
    'items.update',
    'items.delete',
    'group.read',
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
 * Parse a scope string.
 * @param scope String containing scope separated by a spaces.
 * @returns The parsed scope list.
 * @throws If any scope is invalid.
 */
export function parseScope(scope: string): Scope[] {
    const splitScope = scope.split(' ')
    splitScope.forEach(maybeScope => {
        if (!isScope(maybeScope)) {
            throw new Error(`Unable to parse unknown scope '${maybeScope}'`)
        }
    })
    return splitScope as Scope[]
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

/**
 *
 */
export async function checkClientSecret(
    secret: string,
    secretHash: string,
    salt: string | Buffer<ArrayBufferLike>
): Promise<boolean> {
    if (typeof salt === 'string') {
        salt = Buffer.from(fromBase32hex(salt))
    }
    const submittedHash = await hashSecret(secret, salt)
    return submittedHash === secretHash
}

export async function createGroupClient(
    groupId: number,
    ownerId: number,
    scope: Scope[],
    displayName: string,
    description?: string | null
): Promise<GroupClientWithSecret> {
    const secret = randomSecret(32)
    const salt = crypto.randomBytes(16)

    const storedSecret = await hashSecret(secret, salt)
    const storedSalt = toBase32hex(salt)
    const storedScope = scope.join(' ')

    return prisma.apiClient
        .create({
            data: {
                // Store the hashed secret
                secret: storedSecret,
                salt: storedSalt,
                scope: storedScope,
                ownerId,
                groupId,
                displayName,
                description: description ?? Prisma.skip,
            },
        })
        .then(async client => {
            const groupUser = await getGroupUser(client.ownerId, client.groupId)
            if (groupUser == null) {
                throw Error(
                    'Unable to get user and group during client creation'
                )
            }

            return {
                // Send the actual secret just this once
                secret: secret,
                id: client.id,
                scope: parseScope(client.scope),
                group: groupUser.group,
                owner: groupUser.user,
                displayName: client.displayName,
                ...(client.description == null
                    ? {}
                    : { description: client.description }),
            } satisfies GroupClientWithSecret
        })
}

export async function isGroupClientNameTaken(
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

export async function clientExistsInGroup(
    clientId: string,
    groupId: number
): Promise<boolean> {
    return prisma.apiClient
        .findFirst({
            where: {
                id: clientId,
                groupId: groupId,
            },
        })
        .then(client => client !== null)
}

export async function getGroupClient(id: string): Promise<GroupClient | null> {
    const client = await prisma.apiClient.findFirst({
        where: {
            id: id,
        },
    })
    if (client == null) {
        return null
    }

    const groupUser = await getGroupUser(client.ownerId, client.groupId)
    if (groupUser == null) {
        throw Error('Unable to get user and group of client')
    }

    return {
        id: client.id,
        scope: parseScope(client.scope),
        group: groupUser.group,
        owner: groupUser.user,
        displayName: client.displayName,
        ...(client.description == null
            ? {}
            : { description: client.description }),
    }
}

export async function getGroupClientDetailsWithSecretHash(
    id: string
): Promise<GroupClientDetailsWithSecretHash | null> {
    const client = await prisma.apiClient.findFirst({
        where: {
            id: id,
        },
        include: {
            group: {
                select: {
                    gammaId: true,
                },
            },
        },
    })

    if (client == null) {
        return null
    }

    return {
        secretHash: client.secret,
        salt: client.salt,
        id: client.id,
        scope: client.scope,
        group: {
            id: client.groupId,
            gammaId: client.group.gammaId as GroupId,
        },
        ownerId: client.ownerId,
        displayName: client.displayName,
        ...(client.description == null
            ? {}
            : { description: client.description }),
    }
}
