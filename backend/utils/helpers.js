// utils/helpers.js
const crypto = require('crypto');
const moment = require('moment');

// @desc    Format date to readable string
const formatDate = (date, format = 'MMMM Do YYYY, h:mm:ss a') => {
  return moment(date).format(format);
};

// @desc    Format date for database storage
const formatDateForDB = (date) => {
  return new Date(date).toISOString();
};

// @desc    Check if date is in the past
const isPastDate = (date) => {
  return new Date(date) < new Date();
};

// @desc    Check if date is in the future
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

// @desc    Get days between two dates
const getDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// @desc    Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// @desc    Generate secure random token
const generateSecureToken = (length = 64) => {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
};

// @desc    Hash password or sensitive data
const hashString = (str, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(str).digest('hex');
};

// @desc    Encrypt sensitive data
const encrypt = (text, key = process.env.ENCRYPTION_KEY) => {
  if (!key) throw new Error('Encryption key not provided');
  
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

// @desc    Decrypt sensitive data
const decrypt = (encryptedText, key = process.env.ENCRYPTION_KEY) => {
  if (!key) throw new Error('Encryption key not provided');
  
  const algorithm = 'aes-256-cbc';
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encrypted = textParts.join(':');
  const decipher = crypto.createDecipher(algorithm, key);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// @desc    Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// @desc    Validate phone number format
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// @desc    Validate URL format
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// @desc    Sanitize string for safe output
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

// @desc    Capitalize first letter of each word
const capitalizeWords = (str) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// @desc    Convert string to slug
const slugify = (str) => {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// @desc    Truncate string to specified length
const truncateString = (str, length = 100, suffix = '...') => {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
};

// @desc    Format file size to human readable
const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// @desc    Format currency amount
const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount / 100); // Assuming amount is in cents
};

// @desc    Format number with commas
const formatNumber = (num, locale = 'en-US') => {
  return new Intl.NumberFormat(locale).format(num);
};

// @desc    Calculate percentage
const calculatePercentage = (part, whole, decimals = 1) => {
  if (whole === 0) return 0;
  return parseFloat(((part / whole) * 100).toFixed(decimals));
};

// @desc    Generate ticket ID
const generateTicketId = (prefix = 'TU') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

// @desc    Generate QR code data
const generateQRData = (ticketId, baseUrl = process.env.FRONTEND_URL) => {
  return `${baseUrl}/verify/${ticketId}`;
};

// @desc    Parse user agent string
const parseUserAgent = (userAgent) => {
  const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
  const mobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
  
  return {
    browser: browser ? browser[1] : 'Unknown',
    os: os ? os[1] : 'Unknown',
    mobile,
    raw: userAgent
  };
};

// @desc    Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
};

// @desc    Delay execution (for rate limiting, testing)
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// @desc    Retry function with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) break;
      
      const delayMs = baseDelay * Math.pow(2, i);
      await delay(delayMs);
    }
  }
  
  throw lastError;
};

// @desc    Deep clone object
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

// @desc    Remove undefined/null properties from object
const cleanObject = (obj) => {
  const cleaned = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        const nestedCleaned = cleanObject(obj[key]);
        if (Object.keys(nestedCleaned).length > 0) {
          cleaned[key] = nestedCleaned;
        }
      } else {
        cleaned[key] = obj[key];
      }
    }
  }
  return cleaned;
};

// @desc    Check if object is empty
const isEmpty = (obj) => {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
};

// @desc    Get nested object property safely
const getNestedProperty = (obj, path, defaultValue = undefined) => {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current?.[key] === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current;
};

// @desc    Set nested object property
const setNestedProperty = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return obj;
};

// @desc    Generate pagination info
const generatePaginationInfo = (page, limit, total) => {
  const currentPage = parseInt(page);
  const itemsPerPage = parseInt(limit);
  const totalItems = parseInt(total);
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return {
    currentPage,
    itemsPerPage,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    startIndex: (currentPage - 1) * itemsPerPage,
    endIndex: Math.min(currentPage * itemsPerPage - 1, totalItems - 1)
  };
};

// @desc    Generate error response
const generateErrorResponse = (message, code = 'UNKNOWN_ERROR', details = null) => {
  return {
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
};

// @desc    Generate success response
const generateSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// @desc    Rate limit check helper
const checkRateLimit = (requests, windowMs, maxRequests) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Filter requests within the window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  return {
    allowed: recentRequests.length < maxRequests,
    remaining: Math.max(0, maxRequests - recentRequests.length),
    resetTime: windowStart + windowMs,
    requests: recentRequests.length
  };
};

// @desc    Validate environment variables
const validateEnvVars = (requiredVars) => {
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
};

module.exports = {
  // Date utilities
  formatDate,
  formatDateForDB,
  isPastDate,
  isFutureDate,
  getDaysBetween,
  
  // Crypto utilities
  generateRandomString,
  generateSecureToken,
  hashString,
  encrypt,
  decrypt,
  
  // Validation utilities
  isValidEmail,
  isValidPhone,
  isValidUrl,
  
  // String utilities
  sanitizeString,
  capitalizeWords,
  slugify,
  truncateString,
  
  // Formatting utilities
  formatFileSize,
  formatCurrency,
  formatNumber,
  calculatePercentage,
  
  // App-specific utilities
  generateTicketId,
  generateQRData,
  parseUserAgent,
  getClientIP,
  
  // Async utilities
  delay,
  retryWithBackoff,
  
  // Object utilities
  deepClone,
  cleanObject,
  isEmpty,
  getNestedProperty,
  setNestedProperty,
  
  // Response utilities
  generatePaginationInfo,
  generateErrorResponse,
  generateSuccessResponse,
  
  // Other utilities
  checkRateLimit,
  validateEnvVars
};