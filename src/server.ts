import express, {
    type NextFunction,
    type Request,
    type Response,
} from 'express'
import rateLimit from 'express-rate-limit'
import env from '@/config/env.js'
import { sendError, unexpectedError } from '@/errors.js'
import createApiRouter from '@/routers/api.js'
import appendHeader from '@/middleware/setHeader.js'
import cors, { type CorsOptions } from 'cors'
import createOAuth2Router from '@/routers/oauth2.js'
import createPublicRouter from './routers/public.js'

const exposeCors =
    env.EXPOSE_CORS.toLowerCase() === 'true' || env.EXPOSE_CORS === '1'
const corsOptions: CorsOptions = {
    origin: exposeCors ? '*' : true,
    credentials: exposeCors,
}
const trustProxy =
    env.TRUST_PROXY.toLowerCase() === 'true' || env.TRUST_PROXY === '1'

async function main() {
    const app = express()

    // Rate limit
    const limiter = rateLimit({
        windowMs: 3 * 60 * 1000, // 3 minutes
        max: 1000, // Limit each IP to max requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true, // Sends `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers (deprecated)
    })
    app.use(limiter)
    if (trustProxy) {
        console.log('Enabling trust proxy')
        app.set('trust proxy', 1)
    }

    app.use(cors(corsOptions))
    app.options('*', cors())

    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(
        appendHeader('Accept', [
            'application/json',
            'application/x-www-form-urlencoded',
        ])
    )

    const oauth2Router = createOAuth2Router()
    app.use('/oauth2', oauth2Router)

    const publicRouter = await createPublicRouter()
    app.use('/', publicRouter)

    const apiRouter = await createApiRouter()
    app.use('/', apiRouter)

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err)
        console.trace(err)
        sendError(res, unexpectedError(err.message))
    })

    app.listen(parseInt(env.PORT))
    console.log(`Listening on port ${env.PORT}`)
}

main().then(() => {
    console.log('Server ready')
})
