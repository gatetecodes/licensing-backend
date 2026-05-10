import { Request, Response, NextFunction } from 'express';
import { responseWrapper } from '../helpers/response-wrapper';
import httpCode from '../constants/http-codes';
import { logger, log } from '../helpers/logger-helper';
import { CustomError } from '../helpers/errors/custom-error';

interface ErrorT extends Error {
  status?: number;
  errors?: any[];
  details?: Map<unknown, { details: Array<{ path: Array<string | number>; message: string }> }>;
  original?: any;
  fields?: any;
  table?: string;
  constraint?: string;
}

const isCelebrateValidationError = (
  error: unknown
): error is ErrorT & {
  details: Map<
    unknown,
    { details: Array<{ path: Array<string | number>; message: string }> }
  >;
} =>
  Boolean(
    error &&
      typeof error === 'object' &&
      (error as { name?: string }).name === 'CelebrateError' &&
      (error as { details?: unknown }).details instanceof Map
  );

/**
 * Handle custom application errors
 */
export const handleCustomError = (
  error: any,
  res: Response,
  req?: Request
): boolean => {
  if (error instanceof CustomError) {
    logger.error(
      log({
        event:  'APPLICATION_ERROR',
        error: {
          name: error.constructor.name,
          message: error.message,
          statusCode: error.statusCode,
          stack: error.stack
        },
        request: req
          ? {
              method: req.method,
              url: req.url,
              body: req.body
            }
          : undefined
      })
    );

    responseWrapper({
      status: error.statusCode,
      message: error.message,
      context: error.messageKey,
      res,
      errors: error.serializeErrors(),
      data: undefined
    });
    return true;
  }
  return false;
};

/**
 * Handle database-specific errors (Sequelize)
 */
export const handleDatabaseError = (error: any, res: Response): boolean => {
  // Log the error for debugging
  logger.error(
    log({
      event: 'DATABASE_ERROR',
      error: {
        name: error.name,
        message: error.message,
        original: error.original || null,
        constraint: error.constraint || null,
        table: error.table || null,
        fields: error.fields || null
      }
    })
  );

  switch (error.name) {
    case 'SequelizeValidationError': {
      const validationErrors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
        value: err.value,
        type: err.type
      }));

      responseWrapper({
        status: httpCode.BAD_REQUEST,
        message: 'Validation failed',
        res,
        errors: validationErrors,
        data: undefined
      });
      return true;
    }

    case 'SequelizeUniqueConstraintError': {
      const field = error.errors?.[0]?.path || error.fields?.[0] || 'Field';
      const value = error.errors?.[0]?.value || 'value';

      responseWrapper({
        status: httpCode.CONFLICT,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`,
        res,
        data: {
          field,
          value,
          constraint: error.constraint
        }
      });
      return true;
    }

    case 'SequelizeForeignKeyConstraintError': {
      const foreignField = error.fields?.[0] || 'reference';
      responseWrapper({
        status: httpCode.BAD_REQUEST,
        message: `Invalid ${foreignField} - referenced record does not exist`,
        res,
        data: {
          field: foreignField,
          constraint: error.constraint,
          table: error.table
        }
      });
      return true;
    }

    case 'SequelizeConnectionError':
    case 'SequelizeConnectionRefusedError':
      responseWrapper({
        status: httpCode.SERVICE_UNAVAILABLE,
        message: 'Database connection failed',
        res
      });
      return true;

    case 'SequelizeTimeoutError':
      responseWrapper({
        status: httpCode.REQUEST_TIMEOUT,
        message: 'Database operation timed out',
        res
      });
      return true;

    case 'SequelizeDatabaseError':
      // Check for specific database errors
      if (error.original?.code) {
        switch (error.original.code) {
          case '23505': // Unique violation (PostgreSQL)
            responseWrapper({
              status: httpCode.CONFLICT,
              message: 'Duplicate entry detected',
              res
            });
            return true;
          case '23503': // Foreign key violation (PostgreSQL)
            responseWrapper({
              status: httpCode.BAD_REQUEST,
              message: 'Referenced record does not exist',
              res
            });
            return true;
          case '23502': // Not null violation (PostgreSQL)
            responseWrapper({
              status: httpCode.BAD_REQUEST,
              message: 'Required field is missing',
              res
            });
            return true;
        }
      }

      responseWrapper({
        status: httpCode.INTERNAL_SERVER_ERROR,
        message: 'Database operation failed',
        res
      });
      return true;

    default:
      return false; // Not a database error
  }
};

/**
 * Repository helper function to handle database errors consistently
 * @param error - The caught error
 * @param res - Express response object
 * @param next - Express next function
 * @param event - Logger event for non-database errors
 * @param payload - Additional data to log
 * @returns boolean - true if error was handled, false otherwise
 */
export const handleRepositoryError = (
  error: any,
  res: Response,
  next: NextFunction,
  event: string,
  payload?: any
): boolean => {
  // Handle celebrate/Joi validation errors first
  if (isCelebrateValidationError(error)) {
    const validationErrors: Array<{
      segment: string;
      field: string;
      message: string;
    }> = [];

    for (const [segment, detail] of error.details.entries()) {
      for (const joiError of detail.details) {
        validationErrors.push({
          segment: String(segment),
          field: joiError.path.join('.'),
          message: joiError.message
        });
      }
    }

    const message =
      validationErrors[0]?.message || 'Validation failed';

    responseWrapper({
      status: httpCode.BAD_REQUEST,
      message,
      res,
      errors: validationErrors,
      data: undefined
    });
    return true;
  }

  // Try to handle as custom error first
  if (handleCustomError(error, res)) {
    return true;
  }

  // Try to handle as database error
  if (handleDatabaseError(error, res)) {
    return true;
  }

  // Log non-database errors
  logger.error(
    log({
      event,
      payload,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    })
  );

  // Let the global error handler deal with it
  next(error);
  return false;
};

/**
 * Centralized error handling middleware
 */
export default (
  error: ErrorT,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (isCelebrateValidationError(error)) {
    const validationErrors: Array<{
      segment: string;
      field: string;
      message: string;
    }> = [];

    for (const [segment, detail] of error.details.entries()) {
      for (const joiError of detail.details) {
        validationErrors.push({
          segment: String(segment),
          field: joiError.path.join('.'),
          message: joiError.message
        });
      }
    }

    responseWrapper({
      res,
      status: httpCode.BAD_REQUEST,
      message: validationErrors[0]?.message || 'Validation failed',
      errors: validationErrors
    });
    return;
  }

  // Try to handle as custom error first
  if (handleCustomError(error, res, req)) {
    return;
  }

  // Try to handle as database error
  if (handleDatabaseError(error, res)) {
    return;
  }

  // Handle other application errors
  const status = error.status || httpCode.INTERNAL_SERVER_ERROR;

  // Log non-database errors
  logger.error(
    log({
      event: 'APPLICATION_ERROR',
      error: {
        name: error.name,
        message: error.message,
        status,
        stack: error.stack
      },
      request: {
        method: req.method,
        url: req.url,
        body: req.body
      }
    })
  );

  responseWrapper({
    res,
    status,
    message:
      status >= httpCode.INTERNAL_SERVER_ERROR
        ? 'Something went wrong'
        : error.message || 'Internal Server Error'
  });
};
