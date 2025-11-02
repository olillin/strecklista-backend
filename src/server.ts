import cors, { CorsOptions } from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { authorizationCode } from './config/clients'
import env from './config/env'
import createErrorHandler from './middleware/errorHandler'
import appendHeader from './middleware/setHeader'
import validationErrorHandler from './middleware/validationErrorHandler'
import * as validate from './middleware/validators'
import createApiRouter from './routers/api'
import { login as loginRoute } from './routes/login'

const exposeCors =
    env.EXPOSE_CORS.toLowerCase() === 'true' || env.EXPOSE_CORS === '1'
const corsOptions: CorsOptions = {
    origin: exposeCors ? '*' : true,
    credentials: exposeCors,
}

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

    app.use(cors(corsOptions))

    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(
        appendHeader('Accept', [
            'application/json',
            'application/x-www-form-urlencoded',
        ])
    )

    app.get('/authorize', (req, res) => {
        res.redirect(authorizationCode.authorizeUrl())
    })

    app.post('/login', validate.login(), validationErrorHandler, loginRoute())

    const api = await createApiRouter()
    app.use('/api', api)

    app.use(createErrorHandler())

    app.listen(parseInt(env.PORT))
    console.log(`Listening on port ${env.PORT}`)
}

main().then(() => {
    console.log('Server ready')
})
