import { NextFunction, Request, RequestHandler, Response } from 'express'
import { FieldValidationError, validationResult } from 'express-validator'
import {
    invalidPropertyError,
    isErrorResolvable,
    missingRequiredPropertyError,
    unexpectedErrorPleaseReport,
} from '../errors'

const validationErrorHandler: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) {
        return next()
    }

    // Select the first field error
    const validationError = errors.array()[0]
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
        return next(unexpectedErrorPleaseReport(message))
    }

    // Respond to error
    const message = fieldError.msg
    if (isErrorResolvable(message)) {
        // Use as defined error
        return next(message)
    } else if (fieldError.value === undefined && message === 'Invalid value') {
        // Missing required property
        return next(
            missingRequiredPropertyError(fieldError.path, fieldError.location)
        )
    } else {
        // Other error
        console.warn(
            'Validation error does not have a corresponding error definition:'
        )
        console.warn(fieldError)
        return next(invalidPropertyError(fieldError.path, fieldError.location))
    }
}

export default validationErrorHandler
