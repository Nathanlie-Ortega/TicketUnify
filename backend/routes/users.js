// routes/users.js
const express = require('express');
const {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  getUserStats,
  getUserTickets,
  updateUserPreferences,
  sendWelcomeEmail,
  exportUserData,
  checkAdminStatus,
  getUserActivity
} = require('../controllers/userController');

const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, validate, schemas } = require('../middleware/validation');
const rateLimiter = require('../middleware/rateLimiter');
const Joi = require('joi');

const router = express.Router();

// Apply authentication to all user routes
router.use(authenticateToken);

// Apply input sanitization
router.use(sanitizeInput);

// Validation schemas
const updateProfileSchema = Joi.object({
  displayName: Joi.string().trim().min(2).max(100).optional(),
  preferences: Joi.object({
    emailNotifications: Joi.boolean().optional(),
    marketingEmails: Joi.boolean().optional(),
    theme: Joi.string().valid('light', 'dark').optional(),
    language: Joi.string().valid('en', 'es', 'fr', 'de').optional()
  }).optional(),
  additionalInfo: Joi.string().max(500).optional().allow('')
});

const preferencesSchema = Joi.object({
  emailNotifications: Joi.boolean().optional(),
  marketingEmails: Joi.boolean().optional(),
  theme: Joi.string().valid('light', 'dark').optional(),
  language: Joi.string().valid('en', 'es', 'fr', 'de').optional()
});

const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  status: Joi.string().valid('active', 'cancelled').optional(),
  upcoming: Joi.string().valid('true', 'false').optional()
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', getUserProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile',
  rateLimiter.userEmailRateLimit,
  validate(updateProfileSchema),
  updateUserProfile
);

// @route   DELETE /api/users/profile
// @desc    Delete user account
// @access  Private
router.delete('/profile',
  rateLimiter.authRateLimit,
  deleteUserAccount
);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', getUserStats);

// @route   GET /api/users/tickets
// @desc    Get user's tickets
// @access  Private
router.get('/tickets',
  validate(ticketQuerySchema, 'query'),
  getUserTickets
);

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences',
  validate(preferencesSchema),
  updateUserPreferences
);

// @route   POST /api/users/welcome-email
// @desc    Send welcome email to user
// @access  Private
router.post('/welcome-email',
  rateLimiter.emailRateLimit,
  sendWelcomeEmail
);

// @route   GET /api/users/export
// @desc    Export user data (GDPR compliance)
// @access  Private
router.get('/export',
  rateLimiter.analyticsRateLimit,
  exportUserData
);

// @route   GET /api/users/admin-status
// @desc    Check if user has admin privileges
// @access  Private
router.get('/admin-status', checkAdminStatus);

// @route   GET /api/users/activity
// @desc    Get user activity log
// @access  Private
router.get('/activity',
  rateLimiter.analyticsRateLimit,
  getUserActivity
);

module.exports = router;