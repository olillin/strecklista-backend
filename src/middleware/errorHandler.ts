import { ErrorRequestHandler, NextFunction, Request, Response } from "express"
import { isErrorResolvable, sendError, unexpectedError } from "../errors"

/** Send any errors to the client without crashing the server. */
const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (isErrorResolvable(err)) {
        sendError(res, err)
    } else {
        sendError(res, unexpectedError(String(err)))
    }
}

export default errorHandler