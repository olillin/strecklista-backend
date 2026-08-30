import { AuthorizationCode, ClientApi } from 'gammait'
import env from '@/config/env.js'

// Gamma Authorization Code Flow
export const authorizationCode = new AuthorizationCode({
    clientId: env.GAMMA_CLIENT_ID,
    clientSecret: env.GAMMA_CLIENT_SECRET,
    redirectUri: env.GAMMA_REDIRECT_URI,
    scope: ['openid', 'profile'],
})

// Gamma Client API
export const clientApi = new ClientApi({
    authorization: env.GAMMA_API_AUTHORIZATION,
})
