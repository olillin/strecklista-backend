import { NextFunction, Request, RequestHandler, Response } from 'express'
import { FieldValidationError, validationResult } from 'express-validator'
import {
    ApiError,
    invalidPropertyError,
    missingRequiredPropertyError,
    sendError,
    unexpectedError,
} from '../errors'

const validationErrorHandler: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
        next()
        return
    }

    // Select the first field error
    const validationError = result.array()[0]
    let fieldError: FieldValidationError
    if (validationError.type === 'field') {
        fieldError = validationError
    } else if (validationError.type === 'alternative_grouped') {
        fieldError = validationError.nestedErrors[0][0]
    } else if (validationError.type === 'alternative') {
        fieldError = validationError.nestedErrors[0]
    } else {
        // Invalid type
        const message = `Illegal validation error type '${
            validationError.type
        }': ${JSON.stringify(validationError)}`
        console.error(message)
        sendError(res, unexpectedError(message))
        return
    }

    // Respond to error
    const message = fieldError.msg
    if (typeof message === 'number' && message in ApiError) {
        // Use defined error
        sendError(res, message)
    } else if (fieldError.value === undefined && message === 'Invalid value') {
        // Missing required property
        sendError(
            res,
            missingRequiredPropertyError(fieldError.path, fieldError.location)
        )
    } else {
        // Other error
        console.warn(
            'Validation error does not have a corresponding error definition:'
        )
        console.warn(fieldError)
        sendError(
            res,
            invalidPropertyError(fieldError.path, fieldError.location)
        )
    }
}

export default validationErrorHandler
