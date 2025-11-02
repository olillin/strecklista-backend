import { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { ApiError, isApiError, sendError } from '../errors'

/** Send any errors to the client without crashing the server. */
function createErrorHandler(): ErrorRequestHandler {
    return (err: unknown, req: Request, res: Response, next: NextFunction) => {
        if (isApiError(err)) {
            sendError(res, err)
        } else {
            console.error(`An unexpected error occured: ${err}`)
            sendError(res, ApiError.Unexpected)
        }
    }
}

export default createErrorHandler
