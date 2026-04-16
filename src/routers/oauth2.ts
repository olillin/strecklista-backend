import { Router } from 'express'
import validationErrorHandler from '@/middleware/validationErrorHandler.js'
import * as validators from '@/middleware/validators.js'
import setHeader from '@/middleware/setHeader.js'
import { tokenRoute } from '@/routes/oauth2/token.js'
import { authorizationCode } from '@/config/gamma.js'

function createOAuth2Router(): Router {
    const router = Router()

    router.post(
        '/token',
        setHeader('Allow', 'post'),
        validators.token(),
        validationErrorHandler,
        tokenRoute()
    )

    router.get('/authorize', (_req, res) => {
        res.redirect(authorizationCode.authorizeUrl())
    })

    return router
}
export default createOAuth2Router
