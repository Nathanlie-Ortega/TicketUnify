// utils/constants.js
// Application-wide constants and configuration

// API Response Codes
const API_CODES = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'PERMISSION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR: 'SERVER_ERROR'
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Ticket Types and Pricing
const TICKET_TYPES = {
  STANDARD: {
    name: 'Standard',
    price: 0,
    currency: 'USD',
    features: ['Event Access', 'Digital Ticket', 'QR Code'],
    color: '#10B981',
    description: 'Basic event access with digital ticket'
  },
  PREMIUM: {
    name: 'Premium',
    price: 4900, // in cents
    currency: 'USD',
    features: ['Event Access', 'Digital Ticket', 'QR Code', 'Priority Entry', 'Welcome Drink'],
    color: '#3B82F6',
    description: 'Enhanced experience with priority access'
  },
  VIP: {
    name: 'VIP',
    price: 9900, // in cents
    currency: 'USD',
    features: ['Event Access', 'Digital Ticket', 'QR Code', 'VIP Entry', 'Welcome Drink', 'VIP Lounge', 'Premium Seating'],
    color: '#8B5CF6',
    description: 'Exclusive VIP experience with all amenities'
  }
};

// Ticket Status
const TICKET_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  USED: 'used',
  EXPIRED: 'expired',
  PENDING_PAYMENT: 'pending_payment'
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  SUPER_ADMIN: 'super_admin'
};

// Firebase Collections
const COLLECTIONS = {
  TICKETS: 'tickets',
  USERS: 'users',
  EVENTS: 'events',
  ANALYTICS: 'analytics',
  PAYMENTS: 'payments',
  LOGS: 'logs'
};

// File Upload Limits
const FILE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENTS: ['application/pdf', 'text/plain'],
    ALL: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
  },
  FOLDERS: {
    AVATARS: 'uploads/avatars',
    TICKETS: 'uploads/tickets',
    PDFS: 'uploads/pdfs',
    TEMP: 'uploads/temp'
  }
};

// Rate Limiting Configuration
const RATE_LIMITS = {
  API: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  },
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 10
  },
  TICKETS: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 30
  },
  EMAIL: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 3
  },
  UPLOAD: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 10
  }
};

// Email Templates
const EMAIL_TYPES = {
  TICKET_CONFIRMATION: 'ticket_confirmation',
  EVENT_REMINDER: 'event_reminder',
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  TICKET_CANCELLED: 'ticket_cancelled'
};

// Analytics Time Ranges
const TIME_RANGES = {
  LAST_7_DAYS: '7d',
  LAST_30_DAYS: '30d',
  LAST_90_DAYS: '90d',
  LAST_YEAR: '1y',
  ALL_TIME: 'all'
};

// Analytics Metrics
const ANALYTICS_METRICS = {
  TICKETS_CREATED: 'tickets.created',
  TICKETS_CHECKED_IN: 'tickets.checkedIn',
  REVENUE_TOTAL: 'revenue.total',
  USERS_REGISTERED: 'users.registered',
  EVENTS_CREATED: 'events.created'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Stripe Test Card Numbers
const STRIPE_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINE: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED: '4000000000000069',
  PROCESSING_ERROR: '4000000000000119',
  REQUIRES_3DS: '4000002500003155'
};

// Log Levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug'
};

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400 // 24 hours
};

// Validation Rules
const VALIDATION_RULES = {
  TICKET: {
    FULL_NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 100
    },
    EMAIL: {
      MAX_LENGTH: 320
    },
    EVENT_NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 200
    },
    ADDITIONAL_INFO: {
      MAX_LENGTH: 500
    }
  },
  USER: {
    DISPLAY_NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 50
    },
    PASSWORD: {
      MIN_LENGTH: 6,
      MAX_LENGTH: 128
    }
  }
};

// Date Formats
const DATE_FORMATS = {
  API: 'YYYY-MM-DD',
  DISPLAY: 'MMMM Do YYYY',
  DISPLAY_WITH_TIME: 'MMMM Do YYYY, h:mm A',
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  FILENAME: 'YYYY-MM-DD_HH-mm-ss'
};

// Error Messages
const ERROR_MESSAGES = {
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_DATE: 'Please enter a valid date',
    PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
    PASSWORDS_DONT_MATCH: 'Passwords do not match'
  },
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
    ACCESS_DENIED: 'You do not have permission to access this resource',
    USER_NOT_FOUND: 'User not found'
  },
  TICKETS: {
    NOT_FOUND: 'Ticket not found',
    ALREADY_CHECKED_IN: 'This ticket has already been checked in',
    EXPIRED: 'This ticket has expired',
    CANCELLED: 'This ticket has been cancelled'
  },
  PAYMENT: {
    FAILED: 'Payment failed. Please try again.',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    CARD_DECLINED: 'Your card was declined'
  },
  SERVER: {
    INTERNAL_ERROR: 'An internal server error occurred',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    DATABASE_ERROR: 'Database connection error'
  }
};

// Success Messages
const SUCCESS_MESSAGES = {
  TICKET: {
    CREATED: 'Ticket created successfully',
    UPDATED: 'Ticket updated successfully',
    CHECKED_IN: 'Ticket checked in successfully',
    CANCELLED: 'Ticket cancelled successfully'
  },
  USER: {
    REGISTERED: 'Account created successfully',
    UPDATED: 'Profile updated successfully',
    DELETED: 'Account deleted successfully'
  },
  EMAIL: {
    SENT: 'Email sent successfully',
    TICKET_SENT: 'Ticket email sent successfully'
  },
  PAYMENT: {
    SUCCEEDED: 'Payment processed successfully',
    REFUNDED: 'Refund processed successfully'
  }
};

// Feature Flags
const FEATURES = {
  EMAIL_NOTIFICATIONS: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
  STRIPE_PAYMENTS: process.env.ENABLE_STRIPE_PAYMENTS !== 'false',
  ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  FILE_UPLOADS: process.env.ENABLE_FILE_UPLOADS !== 'false',
  ADMIN_DASHBOARD: process.env.ENABLE_ADMIN_DASHBOARD !== 'false'
};

// API Endpoints
const API_ENDPOINTS = {
  TICKETS: '/api/tickets',
  USERS: '/api/users',
  ADMIN: '/api/admin',
  ANALYTICS: '/api/analytics',
  HEALTH: '/health'
};

// Frontend URLs
const FRONTEND_URLS = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  SCANNER: '/scanner',
  VERIFY: '/verify'
};

// Environment Constants
const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

// Regex Patterns
const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  TICKET_ID: /^[A-Z0-9]{6,12}$/
};

module.exports = {
  API_CODES,
  HTTP_STATUS,
  TICKET_TYPES,
  TICKET_STATUS,
  USER_ROLES,
  COLLECTIONS,
  FILE_LIMITS,
  RATE_LIMITS,
  EMAIL_TYPES,
  TIME_RANGES,
  ANALYTICS_METRICS,
  PAYMENT_STATUS,
  STRIPE_TEST_CARDS,
  LOG_LEVELS,
  CACHE_TTL,
  VALIDATION_RULES,
  DATE_FORMATS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURES,
  API_ENDPOINTS,
  FRONTEND_URLS,
  ENVIRONMENT,
  REGEX_PATTERNS
};