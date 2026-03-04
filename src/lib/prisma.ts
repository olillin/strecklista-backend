import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import env from '../config/env'

const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

export { prisma }
