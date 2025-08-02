// routes/analytics.js
const express = require('express');
const {
  getEventAnalytics,
  getTicketTrends,
  getUserEngagement,
  getRevenueAnalytics,
  getRealTimeAnalytics
} = require('../controllers/analyticsController');

const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sanitizeInput, validate } = require('../middleware/validation');
const rateLimiter = require('../middleware/rateLimiter');
const Joi = require('joi');

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);
router.use(sanitizeInput);
router.use(rateLimiter.analyticsRateLimit);

// Validation schemas
const analyticsQuerySchema = Joi.object({
  timeRange: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  eventName: Joi.string().trim().max(200).optional()
});

const trendsQuerySchema = Joi.object({
  timeRange: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  granularity: Joi.string().valid('day', 'week', 'month').optional()
});

const revenueQuerySchema = Joi.object({
  timeRange: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  breakdown: Joi.string().valid('daily', 'weekly', 'monthly').default('daily')
});

const engagementQuerySchema = Joi.object({
  timeRange: Joi.string().valid('7d', '30d', '90d').default('30d')
});

// @route   GET /api/analytics/events
// @desc    Get event analytics and performance metrics
// @access  Private (Admin only)
router.get('/events',
  validate(analyticsQuerySchema, 'query'),
  getEventAnalytics
);

// @route   GET /api/analytics/trends
// @desc    Get ticket creation and check-in trends over time
// @access  Private (Admin only)
router.get('/trends',
  validate(trendsQuerySchema, 'query'),
  getTicketTrends
);

// @route   GET /api/analytics/engagement
// @desc    Get user engagement analytics and segmentation
// @access  Private (Admin only)
router.get('/engagement',
  validate(engagementQuerySchema, 'query'),
  getUserEngagement
);

// @route   GET /api/analytics/revenue
// @desc    Get revenue analytics and breakdown
// @access  Private (Admin only)
router.get('/revenue',
  validate(revenueQuerySchema, 'query'),
  getRevenueAnalytics
);

// @route   GET /api/analytics/realtime
// @desc    Get real-time analytics dashboard data
// @access  Private (Admin only)
router.get('/realtime', getRealTimeAnalytics);

module.exports = router;