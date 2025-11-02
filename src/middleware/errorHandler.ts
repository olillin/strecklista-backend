import { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import {
    isErrorResolvable,
    sendError,
    unexpectedErrorPleaseReport,
} from '../errors'

/** Send any errors to the client without crashing the server. */
const errorHandler: ErrorRequestHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (isErrorResolvable(err)) {
        sendError(res, err)
    } else {
        sendError(res, unexpectedErrorPleaseReport(String(err)))
    }
    next(err)
}

export default errorHandler
