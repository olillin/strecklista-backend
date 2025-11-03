import { RequestHandler, Response, Request, NextFunction } from 'express'
import { ApiError } from '../errors'

function create404Handler(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        next(ApiError.RouteNotFound)
    }
}

export default create404Handler
