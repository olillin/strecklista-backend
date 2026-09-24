import type { Request, Response } from 'express'
import {
    createResponseBody,
    type ServiceHealthyResponse,
} from '@/lib/responses.js'
import { prisma } from '@/lib/prisma.js'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { ApiError, sendError, type ErrorResolvable } from '@/lib/errors.js'
import { clientApi } from '@/lib/gamma.js'

export default async function getHealth(_req: Request, res: Response) {
    // Check database status
    const databaseErrorCode: string | null = await prisma.item
        .findFirst()
        .then(() => null)
        .catch(error => {
            console.error('Unable to reach database:', error)
            if (error instanceof PrismaClientKnownRequestError) {
                return error.code
            }
            return 'unexpected error'
        })

    if (databaseErrorCode != null) {
        sendError(res, {
            code: 503,
            message: `Database unavailable, ${databaseErrorCode}`,
        })
        return
    }

    // Check Gamma status
    const gammaError: ErrorResolvable | null = await clientApi
        .getAuthorities()
        .then(() => null)
        .catch(error => {
            if (error instanceof Error) {
                if (String(error.cause).includes('ConnectTimeoutError')) {
                    console.error('Connection to Gamma timed out:', error)
                    return ApiError.UnreachableGamma
                }

                const statusCode = error.message.match(/(?<=\bcode )\d{3}/)?.[0]
                if (statusCode === '401') {
                    console.error('Received unauthorized response from Gamma')
                    return ApiError.InvalidGammaResponse
                }
            }
            console.error('Unable to reach Gamma:', error)
            return ApiError.UnreachableGamma
        })

    if (gammaError != null) {
        sendError(res, gammaError)
        return
    }

    // Service healthy
    const body = createResponseBody<ServiceHealthyResponse>({
        code: 200,
        message: 'Service healthy',
    })
    res.status(body.data.code).json(body)
}
