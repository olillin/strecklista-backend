import { NextFunction, Request, RequestHandler, Response } from 'express'

function setHeader(key: string, value: string): RequestHandler
function setHeader(key: string, values: Iterable<string>): RequestHandler
function setHeader(
    key: string,
    values: Iterable<string> | string
): RequestHandler {
    const joinedValues: string = Array.from(values).join(', ')
    return (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader(key, joinedValues)
        next()
    }
}
export default setHeader
