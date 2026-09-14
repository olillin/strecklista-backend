import { prisma } from '@/lib/prisma.js'
import { Prisma } from '@/generated/prisma/client.js'
import crypto from 'node:crypto'
import { fromBase32hex, toBase32hex } from '@exodus/bytes/base32.js'
import {
    getGroupUser,
    type Group,
    type GroupUser,
    type User,
} from '@/services/gammaService.js'
import type { GroupId } from 'gammait'

/**
 * Clients uses ULID identifiers which are 26 characters long.
 */
export const CLIENT_ID_LENGTH = 26

export function isClientId(s: string): boolean {
    return s.length === CLIENT_ID_LENGTH
}

export interface GroupClient {
    id: string
    scope: string
    group: Group
    owner: User
    displayName: string
    description?: string
}

export interface GroupClientWithSecret extends GroupClient {
    secret: string
}

export interface GroupClientDetails {
    id: string
    scope: string
    group: {
        id: number
        gammaId: string
    }
    ownerId: number
    displayName: string
    description?: string | null
}

export interface GroupClientDetailsWithSecretHash extends GroupClientDetails {
    secretHash: string
    salt: string
}

function parseGroupClient(
    client: GroupClientDetails,
    owner: GroupUser
): GroupClient {
    return {
        id: client.id,
        scope: client.scope,
        group: owner.group,
        owner: owner.user,
        displayName: client.displayName,
        ...(client.description == null
            ? {}
            : { description: client.description }),
    }
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
            include: {
                group: true,
            },
        })
        .then(async data => {
            const client: GroupClientDetails = {
                ...data,
                group: {
                    id: data.group.id,
                    gammaId: data.group.gammaId as GroupId,
                },
            }

            const groupUser = await getGroupUser(
                client.ownerId,
                client.group.id
            )
            if (groupUser == null) {
                throw Error(
                    'Unable to get user and group during client creation'
                )
            }

            return {
                // Send the actual secret just this once
                secret: secret,
                ...parseGroupClient(client, groupUser),
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

export async function getGroupClient(
    id: string,
    groupId: number
): Promise<GroupClient | null> {
    const client: GroupClientDetails | null = await prisma.apiClient
        .findFirst({
            where: {
                id: id,
                groupId: groupId,
            },
            select: {
                id: true,
                scope: true,
                group: true,
                ownerId: true,
                displayName: true,
                description: true,
            },
        })
        .then(client => {
            if (client == null) return null

            return {
                ...client,
                group: {
                    id: client.group.id,
                    gammaId: client.group.gammaId as GroupId,
                },
            } satisfies GroupClientDetails
        })
    if (client == null) {
        return null
    }

    const groupUser = await getGroupUser(client.ownerId, groupId)
    if (groupUser == null) {
        throw Error('Unable to get user and group of client')
    }

    return parseGroupClient(client, groupUser)
}

export async function getGroupClients(groupId: number): Promise<GroupClient[]> {
    const clients: GroupClientDetails[] = await prisma.apiClient.findMany({
        where: {
            groupId: groupId,
        },
        select: {
            id: true,
            scope: true,
            group: true,
            ownerId: true,
            displayName: true,
            description: true,
        },
    })

    return Promise.all(
        clients.map(async client => {
            const groupUser = await getGroupUser(client.ownerId, groupId)
            if (groupUser == null) {
                throw Error('Unable to get user and group of client')
            }

            return parseGroupClient(client, groupUser)
        })
    )
}

export async function getGroupClientDetailsWithSecretHash(
    id: string
): Promise<GroupClientDetailsWithSecretHash | null> {
    const data = await prisma.apiClient.findFirst({
        where: {
            id: id,
        },
        select: {
            id: true,
            secret: true,
            salt: true,
            scope: true,
            group: true,
            ownerId: true,
            displayName: true,
            description: true,
        },
    })

    if (data == null) {
        return null
    }

    return {
        ...data,
        salt: data.salt,
        secretHash: data.secret,
    }
}

export async function deleteClient(
    clientId: string,
    groupId: number
): Promise<void> {
    return prisma.apiClient
        .deleteMany({
            where: {
                id: clientId,
                groupId: groupId,
            },
        })
        .then()
}
