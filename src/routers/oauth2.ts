import { Router } from 'express'
import validationErrorHandler from '@/middleware/validationErrorHandler.js'
import * as validators from '@/middleware/validators.js'
import setHeader from '@/middleware/setHeader.js'
import { postToken, getAuthorize } from '@/routes/oauth2/index.js'

function createOAuth2Router(): Router {
    const router = Router()

    router.post(
        '/token',
        setHeader('Allow', 'post'),
        ...validators.token(),
        validationErrorHandler,
        postToken
    )
    router.get('/authorize', setHeader('Allow', 'get'), getAuthorize)

    return router
}
export default createOAuth2Router
