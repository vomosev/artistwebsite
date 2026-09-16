'use strict';

const HTTP_RESPONSES = Object.freeze({
  400: { code: 'BAD_REQUEST', message: 'The request could not be processed.' },
  401: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
  403: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  409: { code: 'CONFLICT', message: 'The request conflicts with an existing resource.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'The request payload is too large.' },
  429: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' },
  500: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' }
});

function hasStatus(error, status) {
  return Number(error && (error.statusCode || error.status)) === status;
}

function isValidationError(error) {
  return Boolean(
    error &&
      (error.name === 'ValidationError' ||
        error.code === 'VALIDATION_ERROR' ||
        error.code === 'INVALID_INPUT' ||
        hasStatus(error, 400))
  );
}

function isDuplicateError(error) {
  return Boolean(
    error &&
      (error.name === 'DuplicateError' ||
        error.code === 'DUPLICATE' ||
        error.code === 'DUPLICATE_ENTRY' ||
        error.code === 'ER_DUP_ENTRY' ||
        Number(error.errno) === 1062)
  );
}

function isNotFoundError(error) {
  return Boolean(
    error &&
      (error.name === 'NotFoundError' ||
        error.code === 'NOT_FOUND' ||
        error.code === 'RESOURCE_NOT_FOUND' ||
        hasStatus(error, 404))
  );
}

function classifyError(error) {
  if (
    error &&
    (error.type === 'entity.parse.failed' ||
      (error instanceof SyntaxError && hasStatus(error, 400) && 'body' in error))
  ) {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'The request body contains invalid JSON.'
    };
  }

  if (error && (error.type === 'entity.too.large' || hasStatus(error, 413))) {
    return {
      status: 413,
      ...HTTP_RESPONSES[413]
    };
  }

  if (isDuplicateError(error)) {
    return {
      status: 409,
      code: 'DUPLICATE_RESOURCE',
      message: 'A resource with the provided unique value already exists.'
    };
  }

  if (isNotFoundError(error)) {
    return {
      status: 404,
      ...HTTP_RESPONSES[404]
    };
  }

  if (isValidationError(error)) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid or missing data.'
    };
  }

  const suppliedStatus = Number(error && (error.statusCode || error.status));

  if (
    Number.isInteger(suppliedStatus) &&
    suppliedStatus >= 400 &&
    suppliedStatus < 500
  ) {
    const response = HTTP_RESPONSES[suppliedStatus] || HTTP_RESPONSES[400];

    return {
      status: suppliedStatus,
      code: response.code,
      message: response.message
    };
  }

  return {
    status: 500,
    ...HTTP_RESPONSES[500]
  };
}

function logServerFailure(error, request, status) {
  if (status < 500) {
    return;
  }

  const context = {
    timestamp: new Date().toISOString(),
    method: request && request.method ? request.method : 'UNKNOWN',
    path:
      request && request.originalUrl
        ? request.originalUrl.split('?')[0]
        : request && request.path
          ? request.path
          : 'UNKNOWN',
    status,
    errorName: error && error.name ? error.name : 'Error',
    errorCode: error && error.code ? String(error.code) : undefined
  };

  if (process.env.NODE_ENV === 'production') {
    console.error('[server-error]', context);
    return;
  }

  console.error('[server-error]', context, error);
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const normalized = classifyError(error);
  logServerFailure(error, request, normalized.status);

  const payload = {
    error: normalized.message,
    code: normalized.code
  };

  if (process.env.NODE_ENV !== 'production' && normalized.status >= 500) {
    payload.details =
      error && typeof error.message === 'string'
        ? error.message
        : 'No additional error details are available.';

    if (error && typeof error.stack === 'string') {
      payload.stack = error.stack;
    }
  }

  return response.status(normalized.status).json(payload);
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;