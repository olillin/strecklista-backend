import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { readFileSync } from 'node:fs'

const databaseUrlFile: string | undefined = process.env.DATABASE_URL_FILE
const databaseUrl: string | undefined =
    process.env.DATABASE_URL ??
    (databaseUrlFile ? readFileSync(databaseUrlFile, 'utf8') : undefined)

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'ts-node prisma/seed.ts',
    },
    datasource: {
        url: databaseUrl!,
    },
})
