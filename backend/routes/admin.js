// routes/admin.js
const express = require('express');
const {
  getDashboardStats,
  getAllUsers,
  getAllTickets,
  updateUserRole,
  adminCheckInTicket,
  exportTicketsCSV,
  sendBulkEmail,
  adminDeleteTicket,
  getSystemAnalytics,
  getSystemHealth
} = require('../controllers/adminController');

const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sanitizeInput, validate } = require('../middleware/validation');
const rateLimiter = require('../middleware/rateLimiter');
const Joi = require('joi');

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);
router.use(sanitizeInput);
router.use(rateLimiter.adminRateLimit);

// Validation schemas
const userRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'admin', 'moderator').required(),
  customClaims: Joi.object({
    permissions: Joi.array().items(Joi.string()).optional(),
    level: Joi.number().min(1).max(10).optional()
  }).optional()
});

const bulkEmailSchema = Joi.object({
  eventName: Joi.string().trim().optional(),
  ticketType: Joi.string().valid('Standard', 'Premium', 'VIP').optional(),
  subject: Joi.string().trim().min(1).max(200).required(),
  message: Joi.string().trim().min(1).max(2000).required(),
  emailType: Joi.string().valid('reminder', 'custom').default('custom')
});

const checkInSchema = Joi.object({
  notes: Joi.string().trim().max(500).optional().allow(''),
  location: Joi.string().trim().max(200).optional().allow('')
});

const deleteTicketSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required()
});

const analyticsQuerySchema = Joi.object({
  timeRange: Joi.string().valid('7d', '30d', '90d', '1y').default('30d')
});

const userQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().min(1).max(100).optional(),
  status: Joi.string().valid('active', 'deleted').optional(),
  sortBy: Joi.string().valid('createdAt', 'displayName', 'email', 'lastLoginAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().min(1).max(100).optional(),
  status: Joi.string().valid('active', 'cancelled').optional(),
  ticketType: Joi.string().valid('Standard', 'Premium', 'VIP').optional(),
  eventName: Joi.string().trim().min(1).max(200).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  checkedIn: Joi.string().valid('true', 'false').optional(),
  sortBy: Joi.string().valid('createdAt', 'eventDate', 'userName', 'eventName').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const exportQuerySchema = Joi.object({
  eventName: Joi.string().trim().optional(),
  status: Joi.string().valid('active', 'cancelled').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', getDashboardStats);

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Private (Admin only)
router.get('/users',
  validate(userQuerySchema, 'query'),
  getAllUsers
);

// @route   GET /api/admin/tickets
// @desc    Get all tickets with advanced filtering
// @access  Private (Admin only)
router.get('/tickets',
  validate(ticketQuerySchema, 'query'),
  getAllTickets
);

// @route   PUT /api/admin/users/:userId/role
// @desc    Update user role and permissions
// @access  Private (Admin only)
router.put('/users/:userId/role',
  validate(userRoleSchema),
  updateUserRole
);

// @route   PATCH /api/admin/tickets/:ticketId/checkin
// @desc    Manually check in a ticket (admin)
// @access  Private (Admin only)
router.patch('/tickets/:ticketId/checkin',
  validate(checkInSchema),
  adminCheckInTicket
);

// @route   DELETE /api/admin/tickets/:ticketId
// @desc    Cancel/delete a ticket (admin)
// @access  Private (Admin only)
router.delete('/tickets/:ticketId',
  validate(deleteTicketSchema),
  adminDeleteTicket
);

// @route   GET /api/admin/export/tickets
// @desc    Export tickets to CSV
// @access  Private (Admin only)
router.get('/export/tickets',
  validate(exportQuerySchema, 'query'),
  rateLimiter.analyticsRateLimit,
  exportTicketsCSV
);

// @route   POST /api/admin/bulk-email
// @desc    Send bulk emails to ticket holders
// @access  Private (Admin only)
router.post('/bulk-email',
  validate(bulkEmailSchema),
  rateLimiter.emailRateLimit,
  sendBulkEmail
);

// @route   GET /api/admin/analytics
// @desc    Get system analytics and insights
// @access  Private (Admin only)
router.get('/analytics',
  validate(analyticsQuerySchema, 'query'),
  rateLimiter.analyticsRateLimit,
  getSystemAnalytics
);

// @route   GET /api/admin/health
// @desc    Get system health status
// @access  Private (Admin only)
router.get('/health', getSystemHealth);

module.exports = router;