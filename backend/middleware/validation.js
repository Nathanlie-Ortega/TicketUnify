// middleware/validation.js
const Joi = require('joi');
const { createValidationError, asyncHandler } = require('./errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const schemas = {
  // Ticket creation validation
  createTicket: Joi.object({
    fullName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.empty': 'Full name is required',
        'string.min': 'Full name must be at least 2 characters',
        'string.max': 'Full name cannot exceed 100 characters'
      }),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required'
      }),
    
    eventName: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Event name is required',
        'string.min': 'Event name must be at least 2 characters',
        'string.max': 'Event name cannot exceed 200 characters'
      }),
    
    eventDate: Joi.date()
      .iso()
      .min('now')
      .required()
      .messages({
        'date.base': 'Please provide a valid date',
        'date.min': 'Event date cannot be in the past',
        'any.required': 'Event date is required'
      }),
    
    eventLocation: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Event location is required',
        'string.min': 'Event location must be at least 2 characters',
        'string.max': 'Event location cannot exceed 200 characters'
      }),
    
    ticketType: Joi.string()
      .valid('Standard', 'Premium', 'VIP')
      .required()
      .messages({
        'any.only': 'Ticket type must be Standard, Premium, or VIP',
        'any.required': 'Ticket type is required'
      }),
    
    additionalInfo: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Additional info cannot exceed 500 characters'
      })
  }),

  // Ticket update validation
  updateTicket: Joi.object({
    fullName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional(),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .optional(),
    
    eventName: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .optional(),
    
    eventDate: Joi.date()
      .iso()
      .min('now')
      .optional(),
    
    eventLocation: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .optional(),
    
    ticketType: Joi.string()
      .valid('Standard', 'Premium', 'VIP')
      .optional(),
    
    additionalInfo: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('')
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  }),

  // User registration validation
  registerUser: Joi.object({
    fullName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required(),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .required(),
    
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters',
        'string.max': 'Password cannot exceed 128 characters'
      })
  }),

  // Query parameters validation
  ticketQuery: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .optional(),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional(),
    
    sortBy: Joi.string()
      .valid('createdAt', 'eventDate', 'fullName', 'eventName')
      .default('createdAt')
      .optional(),
    
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
      .optional(),
    
    status: Joi.string()
      .valid('active', 'checked-in', 'cancelled')
      .optional(),
    
    ticketType: Joi.string()
      .valid('Standard', 'Premium', 'VIP')
      .optional(),
    
    eventName: Joi.string()
      .trim()
      .min(1)
      .optional(),
    
    startDate: Joi.date()
      .iso()
      .optional(),
    
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .optional()
      .messages({
        'date.min': 'End date must be after start date'
      }),
    
    search: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .optional()
  }),

  // Check-in validation
  checkIn: Joi.object({
    ticketId: Joi.string()
      .trim()
      .required()
      .messages({
        'string.empty': 'Ticket ID is required'
      }),
    
    location: Joi.string()
      .trim()
      .max(200)
      .optional(),
    
    notes: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('')
  }),

  // Email sending validation
  sendEmail: Joi.object({
    to: Joi.string()
      .email()
      .required(),
    
    ticketId: Joi.string()
      .trim()
      .required(),
    
    template: Joi.string()
      .valid('ticket', 'reminder', 'update')
      .default('ticket')
      .optional()
  }),

  // File upload validation
  fileUpload: Joi.object({
    mimetype: Joi.string()
      .valid('image/jpeg', 'image/png', 'image/gif', 'image/webp')
      .required()
      .messages({
        'any.only': 'Only JPEG, PNG, GIF, and WebP images are allowed'
      }),
    
    size: Joi.number()
      .max(5 * 1024 * 1024) // 5MB
      .required()
      .messages({
        'number.max': 'File size cannot exceed 5MB'
      })
  })
};

// Generic validation middleware
const validate = (schema, source = 'body') => {
  return asyncHandler(async (req, res, next) => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.warn('Validation error:', {
        endpoint: req.originalUrl,
        method: req.method,
        errors: error.details,
        data: data
      });

      throw createValidationError(errorMessage);
    }

    // Replace original data with validated and sanitized data
    req[source] = value;
    next();
  });
};

// Specific validation middleware functions
const validateTicketCreation = validate(schemas.createTicket, 'body');
const validateTicketUpdate = validate(schemas.updateTicket, 'body');
const validateUserRegistration = validate(schemas.registerUser, 'body');
const validateTicketQuery = validate(schemas.ticketQuery, 'query');
const validateCheckIn = validate(schemas.checkIn, 'body');
const validateEmailSending = validate(schemas.sendEmail, 'body');

// File validation middleware
const validateFileUpload = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(); // File upload is optional
  }

  const { error } = schemas.fileUpload.validate({
    mimetype: req.file.mimetype,
    size: req.file.size
  });

  if (error) {
    const errorMessage = error.details
      .map(detail => detail.message)
      .join(', ');
    
    logger.warn('File validation error:', {
      endpoint: req.originalUrl,
      file: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      },
      error: errorMessage
    });

    throw createValidationError(errorMessage);
  }

  next();
});

// Sanitize HTML content
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitization middleware
const sanitizeInput = asyncHandler(async (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeHtml(obj[key].trim());
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  // Sanitize body, query, and params
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);

  next();
});

// Custom validation for MongoDB ObjectIds
const validateObjectId = (paramName = 'id') => {
  return asyncHandler(async (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      throw createValidationError(`${paramName} parameter is required`);
    }

    // Simple check for valid ObjectId format (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw createValidationError(`Invalid ${paramName} format`);
    }

    next();
  });
};

module.exports = {
  schemas,
  validate,
  validateTicketCreation,
  validateTicketUpdate,
  validateUserRegistration,
  validateTicketQuery,
  validateCheckIn,
  validateEmailSending,
  validateFileUpload,
  sanitizeInput,
  validateObjectId,
  sanitizeHtml
};