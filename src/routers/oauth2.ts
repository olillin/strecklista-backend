import { Router } from 'express'
import validationErrorHandler from '../middleware/validationErrorHandler'
import * as validators from '../middleware/validators'
import setHeader from '../middleware/setHeader'
import { tokenRoute } from '../routes/oauth2/token'

function createOAuth2Router(): Router {
    const router = Router()

    router.post(
        '/token',
        setHeader('Allow', 'post'),
        validators.token(),
        validationErrorHandler,
        tokenRoute()
    )

    return router
}
export default createOAuth2Router
