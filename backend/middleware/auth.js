// middleware/auth.js
const { verifyIdToken, getUserByUid } = require('../utils/firebase-admin');
const logger = require('../utils/logger');

// Middleware to authenticate Firebase ID tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.logAuth('missing_token', null, false, { 
        ip: req.ip,
        endpoint: req.originalUrl 
      });
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(token);
    
    // Get additional user information
    const userRecord = await getUserByUid(decodedToken.uid);
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || userRecord.email,
      name: decodedToken.name || userRecord.displayName,
      emailVerified: decodedToken.email_verified || userRecord.emailVerified,
      customClaims: decodedToken.customClaims || {},
      firebase: decodedToken
    };

    logger.logAuth('token_verified', req.user.uid, true, {
      email: req.user.email,
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    logger.logAuth('token_verification_failed', null, false, { 
      error: error.message,
      ip: req.ip,
      endpoint: req.originalUrl 
    });

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired. Please sign in again.',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Token revoked. Please sign in again.',
        code: 'AUTH_TOKEN_REVOKED'
      });
    } else if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ 
        error: 'Invalid token format.',
        code: 'AUTH_TOKEN_INVALID'
      });
    }

    return res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const isAdmin = req.user.customClaims?.admin === true || 
                   req.user.customClaims?.role === 'admin' ||
                   req.user.email === process.env.ADMIN_EMAIL;

    if (!isAdmin) {
      logger.logAuth('admin_access_denied', req.user.uid, false, {
        email: req.user.email,
        customClaims: req.user.customClaims,
        endpoint: req.originalUrl
      });

      return res.status(403).json({ 
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }

    logger.logAuth('admin_access_granted', req.user.uid, true, {
      email: req.user.email,
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.uid;
      const isAdmin = req.user.customClaims?.admin === true || 
                     req.user.customClaims?.role === 'admin' ||
                     req.user.email === process.env.ADMIN_EMAIL;

      // Admin can access any resource
      if (isAdmin) {
        return next();
      }

      // For ticket resources, check if user created the ticket
      // This will be validated in the controller with database lookup
      req.requireOwnership = true;
      next();
    } catch (error) {
      logger.error('Error in requireOwnershipOrAdmin middleware:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without user info
    }

    // Try to verify the token
    const decodedToken = await verifyIdToken(token);
    const userRecord = await getUserByUid(decodedToken.uid);
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || userRecord.email,
      name: decodedToken.name || userRecord.displayName,
      emailVerified: decodedToken.email_verified || userRecord.emailVerified,
      customClaims: decodedToken.customClaims || {},
      firebase: decodedToken
    };

    next();
  } catch (error) {
    // If token verification fails, continue without user info
    logger.logAuth('optional_auth_failed', null, false, { 
      error: error.message,
      endpoint: req.originalUrl 
    });
    next();
  }
};

// Middleware to extract user info from token without requiring authentication
const extractUserInfo = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decodedToken = await verifyIdToken(token);
        req.tokenInfo = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified
        };
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.debug('Token extraction failed:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Error in extractUserInfo middleware:', error);
    next(); // Continue even if extraction fails
  }
};

// Middleware to check API key for certain endpoints
const requireApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      logger.warn('API_KEY not configured in environment');
      return next(); // Skip API key validation if not configured
    }

    if (!apiKey || apiKey !== validApiKey) {
      logger.logAuth('api_key_invalid', null, false, { 
        providedKey: apiKey ? 'provided' : 'missing',
        ip: req.ip,
        endpoint: req.originalUrl 
      });

      return res.status(401).json({ 
        error: 'Valid API key required',
        code: 'API_KEY_REQUIRED'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in requireApiKey middleware:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Rate limiting for authentication attempts
const authRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for successful authentications
    return req.user !== undefined;
  }
});

module.exports = {
  authenticateToken,
  requireAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  extractUserInfo,
  requireApiKey,
  authRateLimit
};