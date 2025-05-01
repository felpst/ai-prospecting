/**
 * Global error handler middleware for Express
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  console.error('Error:', err);

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Create error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Custom error class with status code
 */
export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler to catch errors in async route handlers
 * Usage: router.get('/resource', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
}; 