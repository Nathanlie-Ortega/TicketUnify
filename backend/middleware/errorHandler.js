// middleware/errorHandler.js
const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  logger.logError(err, req);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please log in again';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    const firebaseErrorMessages = {
      'auth/id-token-expired': 'Token expired. Please sign in again.',
      'auth/id-token-revoked': 'Token revoked. Please sign in again.',
      'auth/invalid-id-token': 'Invalid token format.',
      'auth/user-not-found': 'User not found.',
      'auth/email-already-exists': 'Email already in use.',
      'auth/weak-password': 'Password is too weak.',
      'auth/invalid-email': 'Invalid email address.'
    };

    const message = firebaseErrorMessages[err.code] || 'Authentication error';
    const statusCode = err.code === 'auth/user-not-found' ? 404 : 
                      err.code.includes('expired') || err.code.includes('invalid') ? 401 : 400;
    error = new AppError(message, statusCode, err.code.toUpperCase().replace('/', '_'));
  }

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    const message = err.message || 'Payment processing error';
    error = new AppError(message, 400, 'PAYMENT_ERROR');
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large. Maximum size is 5MB';
    error = new AppError(message, 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = new AppError(message, 400, 'UNEXPECTED_FILE');
  }

  // Email sending errors
  if (err.code === 'EAUTH' || err.code === 'ECONNECTION') {
    const message = 'Failed to send email. Please try again later';
    error = new AppError(message, 500, 'EMAIL_SEND_ERROR');
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests. Please try again later';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';
  const code = error.code || 'INTERNAL_SERVER_ERROR';

  // Development vs Production error responses
  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      status,
      error: error.message,
      code,
      stack: err.stack,
      originalError: err
    });
  } else {
    // Production error response
    if (error.isOperational) {
      // Operational, trusted error: send message to client
      res.status(statusCode).json({
        status,
        error: error.message,
        code
      });
    } else {
      // Programming or other unknown error: don't leak error details
      logger.error('Unknown error:', err);
      res.status(500).json({
        status: 'error',
        error: 'Something went wrong',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler for undefined routes
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

// Validation error helper
const createValidationError = (message, field = null) => {
  const error = new AppError(message, 400, 'VALIDATION_ERROR');
  if (field) {
    error.field = field;
  }
  return error;
};

// Permission error helper
const createPermissionError = (message = 'Access denied') => {
  return new AppError(message, 403, 'ACCESS_DENIED');
};

// Not found error helper
const createNotFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND');
};

// Conflict error helper
const createConflictError = (message = 'Resource already exists') => {
  return new AppError(message, 409, 'RESOURCE_CONFLICT');
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFound,
  createValidationError,
  createPermissionError,
  createNotFoundError,
  createConflictError
};