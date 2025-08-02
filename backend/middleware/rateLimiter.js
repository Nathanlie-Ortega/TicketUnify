// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Create a custom rate limit handler
const createRateLimitHandler = (message, code) => (req, res) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    endpoint: req.originalUrl,
    userAgent: req.get('User-Agent'),
    message
  });

  res.status(429).json({
    error: message,
    code,
    retryAfter: Math.round(req.rateLimit.resetTime / 1000) || 60
  });
};

// General API rate limit
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many requests from this IP, please try again later.',
    'RATE_LIMIT_EXCEEDED'
  )
});

// Strict rate limit for ticket creation
const ticketCreationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 ticket creations per minute
  message: 'Too many tickets created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many tickets created from this IP, please try again later.',
    'TICKET_CREATION_RATE_LIMIT_EXCEEDED'
  ),
  skip: (req) => {
    // Skip rate limiting for authenticated users (they have their own limits)
    return req.user !== undefined;
  }
});

// Rate limit for ticket operations
const ticketRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 ticket operations per minute
  message: 'Too many ticket operations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many ticket operations from this IP, please try again later.',
    'TICKET_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for QR code scanning
const scanRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 scans per minute
  message: 'Too many scan attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many scan attempts from this IP, please try again later.',
    'SCAN_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for email sending
const emailRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // limit each IP to 3 emails per minute
  message: 'Too many email requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many email requests from this IP, please try again later.',
    'EMAIL_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for authentication attempts
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth attempts per windowMs
  message: 'Too many authentication attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many authentication attempts from this IP, please try again later.',
    'AUTH_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for admin operations
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 admin operations per minute
  message: 'Too many admin operations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many admin operations from this IP, please try again later.',
    'ADMIN_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 uploads per minute
  message: 'Too many file uploads from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many file uploads from this IP, please try again later.',
    'UPLOAD_RATE_LIMIT_EXCEEDED'
  )
});

// Rate limit for analytics requests
const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 analytics requests per minute
  message: 'Too many analytics requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many analytics requests from this IP, please try again later.',
    'ANALYTICS_RATE_LIMIT_EXCEEDED'
  )
});

// Custom rate limiter based on user ID for authenticated requests
const createUserBasedRateLimit = (windowMs, max, message, code) => {
  const userLimits = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip if not authenticated
    }

    const userId = req.user.uid;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (userLimits.has(userId)) {
      const userRequests = userLimits.get(userId).filter(time => time > windowStart);
      userLimits.set(userId, userRequests);
    } else {
      userLimits.set(userId, []);
    }

    const userRequests = userLimits.get(userId);

    if (userRequests.length >= max) {
      logger.warn('User rate limit exceeded', {
        userId,
        endpoint: req.originalUrl,
        requestCount: userRequests.length,
        limit: max,
        windowMs
      });

      return res.status(429).json({
        error: message,
        code,
        retryAfter: Math.round((userRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    userLimits.set(userId, userRequests);

    next();
  };
};

// User-based rate limits
const userTicketCreationRateLimit = createUserBasedRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 tickets per hour per user
  'You have created too many tickets recently, please try again later.',
  'USER_TICKET_CREATION_RATE_LIMIT_EXCEEDED'
);

const userEmailRateLimit = createUserBasedRateLimit(
  60 * 1000, // 1 minute
  2, // 2 emails per minute per user
  'You have sent too many emails recently, please try again later.',
  'USER_EMAIL_RATE_LIMIT_EXCEEDED'
);

// Adaptive rate limiting based on server load
const adaptiveRateLimit = (req, res, next) => {
  // Get system metrics (simplified)
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  // If memory usage is high, apply stricter rate limiting
  if (memoryUsagePercent > 80) {
    logger.warn('High memory usage detected, applying adaptive rate limiting', {
      memoryUsagePercent,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    // Apply stricter rate limit
    const strictRateLimit = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // reduce to 10 requests per minute
      message: 'Server is under high load, please try again later.',
      handler: createRateLimitHandler(
        'Server is under high load, please try again later.',
        'ADAPTIVE_RATE_LIMIT_EXCEEDED'
      )
    });

    return strictRateLimit(req, res, next);
  }

  next();
};

module.exports = {
  apiRateLimit,
  ticketCreationRateLimit,
  ticketRateLimit,
  scanRateLimit,
  emailRateLimit,
  authRateLimit,
  adminRateLimit,
  uploadRateLimit,
  analyticsRateLimit,
  userTicketCreationRateLimit,
  userEmailRateLimit,
  adaptiveRateLimit
};