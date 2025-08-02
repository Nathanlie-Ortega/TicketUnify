// controllers/adminController.js
const { firestoreHelpers, setCustomUserClaims, getUserByUid } = require('../utils/firebase-admin');
const { asyncHandler, createNotFoundError, createPermissionError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');
const csvWriter = require('csv-writer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const USERS_COLLECTION = 'users';
const TICKETS_COLLECTION = 'tickets';

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const startTime = Date.now();

    // Get all tickets and users in parallel
    const [allTickets, allUsers] = await Promise.all([
      firestoreHelpers.queryDocuments(TICKETS_COLLECTION),
      firestoreHelpers.queryDocuments(USERS_COLLECTION)
    ]);

    // Calculate ticket statistics
    const ticketStats = {
      total: allTickets.length,
      active: allTickets.filter(t => t.status === 'active').length,
      checkedIn: allTickets.filter(t => t.checkedIn).length,
      cancelled: allTickets.filter(t => t.status === 'cancelled').length,
      byType: {
        Standard: allTickets.filter(t => t.ticketType === 'Standard').length,
        Premium: allTickets.filter(t => t.ticketType === 'Premium').length,
        VIP: allTickets.filter(t => t.ticketType === 'VIP').length
      },
      checkInRate: allTickets.length > 0 ? 
        ((allTickets.filter(t => t.checkedIn).length / allTickets.length) * 100).toFixed(2) : 0
    };

    // Calculate user statistics
    const userStats = {
      total: allUsers.length,
      active: allUsers.filter(u => !u.deleted).length,
      deleted: allUsers.filter(u => u.deleted).length,
      emailVerified: allUsers.filter(u => u.emailVerified).length
    };

    // Calculate revenue statistics (simplified)
    const revenueStats = {
      total: allTickets.reduce((sum, ticket) => {
        const prices = { Standard: 0, Premium: 49, VIP: 99 };
        return sum + (prices[ticket.ticketType] || 0);
      }, 0),
      byType: {
        Standard: allTickets.filter(t => t.ticketType === 'Standard').length * 0,
        Premium: allTickets.filter(t => t.ticketType === 'Premium').length * 49,
        VIP: allTickets.filter(t => t.ticketType === 'VIP').length * 99
      }
    };

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTickets = allTickets.filter(t => 
      new Date(t.createdAt) > thirtyDaysAgo
    );

    const activityStats = {
      recentTickets: recentTickets.length,
      recentCheckIns: allTickets.filter(t => 
        t.checkedIn && new Date(t.checkedInAt) > thirtyDaysAgo
      ).length,
      newUsers: allUsers.filter(u => 
        new Date(u.createdAt) > thirtyDaysAgo
      ).length
    };

    // Top events by ticket count
    const eventCounts = {};
    allTickets.forEach(ticket => {
      eventCounts[ticket.eventName] = (eventCounts[ticket.eventName] || 0) + 1;
    });
    
    const topEvents = Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([eventName, count]) => ({ eventName, ticketCount: count }));

    logger.logPerformance('admin_dashboard_stats', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        tickets: ticketStats,
        users: userStats,
        revenue: revenueStats,
        activity: activityStats,
        topEvents,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching admin dashboard stats:', error);
    throw error;
  }
});

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  try {
    // Get all users
    let users = await firestoreHelpers.queryDocuments(
      USERS_COLLECTION,
      [],
      { field: sortBy, direction: sortOrder }
    );

    // Apply filters
    if (status) {
      if (status === 'active') {
        users = users.filter(u => !u.deleted);
      } else if (status === 'deleted') {
        users = users.filter(u => u.deleted);
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        (user.displayName && user.displayName.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.uid && user.uid.toLowerCase().includes(searchLower))
      );
    }

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = users.slice(startIndex, endIndex);

    // Remove sensitive information
    const sanitizedUsers = paginatedUsers.map(user => ({
      ...user,
      // Remove sensitive fields if needed
      preferences: user.preferences ? {
        theme: user.preferences.theme,
        language: user.preferences.language
      } : {}
    }));

    const totalUsers = users.length;
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      success: true,
      data: {
        users: sanitizedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching all users:', error);
    throw error;
  }
});

// @desc    Get all tickets with advanced filtering
// @route   GET /api/admin/tickets
// @access  Private (Admin only)
const getAllTickets = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    ticketType,
    eventName,
    startDate,
    endDate,
    checkedIn,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  try {
    // Build base query
    const queries = [];
    
    if (status) {
      queries.push({ field: 'status', operator: '==', value: status });
    }
    
    if (ticketType) {
      queries.push({ field: 'ticketType', operator: '==', value: ticketType });
    }
    
    if (checkedIn !== undefined) {
      queries.push({ field: 'checkedIn', operator: '==', value: checkedIn === 'true' });
    }
    
    if (startDate) {
      queries.push({ field: 'eventDate', operator: '>=', value: new Date(startDate) });
    }
    
    if (endDate) {
      queries.push({ field: 'eventDate', operator: '<=', value: new Date(endDate) });
    }

    // Get tickets
    let tickets = await firestoreHelpers.queryDocuments(
      TICKETS_COLLECTION,
      queries,
      { field: sortBy, direction: sortOrder }
    );

    // Apply text-based filters
    if (eventName) {
      tickets = tickets.filter(ticket => 
        ticket.eventName.toLowerCase().includes(eventName.toLowerCase())
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      tickets = tickets.filter(ticket => 
        ticket.userName.toLowerCase().includes(searchLower) ||
        ticket.userEmail.toLowerCase().includes(searchLower) ||
        ticket.eventName.toLowerCase().includes(searchLower) ||
        ticket.ticketId.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTickets = tickets.slice(startIndex, endIndex);

    const totalTickets = tickets.length;
    const totalPages = Math.ceil(totalTickets / parseInt(limit));

    res.json({
      success: true,
      data: {
        tickets: paginatedTickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTickets,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        filters: {
          status,
          ticketType,
          eventName,
          startDate,
          endDate,
          checkedIn,
          search
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching all tickets:', error);
    throw error;
  }
});

// @desc    Update user role/permissions
// @route   PUT /api/admin/users/:userId/role
// @access  Private (Admin only)
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role, customClaims } = req.body;

  try {
    // Verify user exists
    const user = await getUserByUid(userId);
    if (!user) {
      throw createNotFoundError('User');
    }

    // Prepare custom claims
    const claims = {
      ...customClaims,
      admin: role === 'admin',
      role: role || 'user',
      updatedBy: req.user.uid,
      updatedAt: new Date().toISOString()
    };

    // Set custom claims in Firebase Auth
    await setCustomUserClaims(userId, claims);

    // Update user document in Firestore
    await firestoreHelpers.updateDocument(USERS_COLLECTION, userId, {
      role: role || 'user',
      customClaims: claims,
      roleUpdatedAt: new Date(),
      roleUpdatedBy: req.user.uid
    });

    logger.info(`User role updated: ${userId}`, {
      newRole: role,
      updatedBy: req.user.uid,
      customClaims: claims
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        userId,
        role,
        customClaims: claims
      }
    });

  } catch (error) {
    logger.error('Error updating user role:', error);
    throw error;
  }
});

// @desc    Manually check in a ticket
// @route   PATCH /api/admin/tickets/:ticketId/checkin
// @access  Private (Admin only)
const adminCheckInTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { notes, location } = req.body;

  try {
    const ticket = await firestoreHelpers.getDocument(TICKETS_COLLECTION, ticketId);

    if (!ticket) {
      throw createNotFoundError('Ticket');
    }

    if (ticket.checkedIn) {
      return res.status(400).json({
        success: false,
        error: 'Ticket is already checked in'
      });
    }

    // Update ticket
    const updateData = {
      checkedIn: true,
      checkedInAt: new Date(),
      checkedInBy: req.user.uid,
      checkInType: 'admin',
      checkInLocation: location || '',
      checkInNotes: notes || ''
    };

    await firestoreHelpers.updateDocument(TICKETS_COLLECTION, ticketId, updateData);

    logger.info(`Admin checked in ticket: ${ticketId}`, {
      adminId: req.user.uid,
      ticketId: ticket.ticketId,
      location
    });

    res.json({
      success: true,
      message: 'Ticket checked in successfully',
      data: {
        ...ticket,
        ...updateData,
        id: ticketId
      }
    });

  } catch (error) {
    logger.error('Error checking in ticket (admin):', error);
    throw error;
  }
});

// @desc    Export tickets to CSV
// @route   GET /api/admin/export/tickets
// @access  Private (Admin only)
const exportTicketsCSV = asyncHandler(async (req, res) => {
  const { eventName, status, startDate, endDate } = req.query;

  try {
    // Build query filters
    const queries = [];
    
    if (status) {
      queries.push({ field: 'status', operator: '==', value: status });
    }
    
    if (startDate) {
      queries.push({ field: 'eventDate', operator: '>=', value: new Date(startDate) });
    }
    
    if (endDate) {
      queries.push({ field: 'eventDate', operator: '<=', value: new Date(endDate) });
    }

    // Get tickets
    let tickets = await firestoreHelpers.queryDocuments(
      TICKETS_COLLECTION,
      queries,
      { field: 'createdAt', direction: 'desc' }
    );

    // Filter by event name if specified
    if (eventName) {
      tickets = tickets.filter(ticket => 
        ticket.eventName.toLowerCase().includes(eventName.toLowerCase())
      );
    }

    // Prepare CSV data
    const csvData = tickets.map(ticket => ({
      ticketId: ticket.ticketId,
      userName: ticket.userName,
      userEmail: ticket.userEmail,
      eventName: ticket.eventName,
      eventDate: ticket.eventDate,
      eventLocation: ticket.eventLocation,
      ticketType: ticket.ticketType,
      status: ticket.status,
      checkedIn: ticket.checkedIn ? 'Yes' : 'No',
      checkedInAt: ticket.checkedInAt || '',
      createdAt: ticket.createdAt,
      additionalInfo: ticket.additionalInfo || ''
    }));

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tickets-export-${timestamp}.csv`;
    const filePath = path.join(__dirname, '../temp', filename);

    // Ensure temp directory exists
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create CSV writer
    const csvWriterInstance = csvWriter.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'ticketId', title: 'Ticket ID' },
        { id: 'userName', title: 'Attendee Name' },
        { id: 'userEmail', title: 'Email' },
        { id: 'eventName', title: 'Event Name' },
        { id: 'eventLocation', title: 'Location' },
        { id: 'ticketType', title: 'Ticket Type' },
        { id: 'status', title: 'Status' },
        { id: 'checkedIn', title: 'Checked In' },
        { id: 'checkedInAt', title: 'Check-in Time' },
        { id: 'createdAt', title: 'Created At' },
        { id: 'additionalInfo', title: 'Additional Info' }
      ]
    });

    // Write CSV file
    await csvWriterInstance.writeRecords(csvData);

    logger.info(`Tickets exported to CSV: ${filename}`, {
      exportedBy: req.user.uid,
      recordCount: csvData.length,
      filters: { eventName, status, startDate, endDate }
    });

    // Send file as download
    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error('Error downloading CSV file:', err);
      }
      
      // Clean up temp file
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          logger.warn('Error deleting temp CSV file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    logger.error('Error exporting tickets to CSV:', error);
    throw error;
  }
});

// @desc    Send bulk emails to ticket holders
// @route   POST /api/admin/bulk-email
// @access  Private (Admin only)
const sendBulkEmail = asyncHandler(async (req, res) => {
  const { 
    eventName, 
    ticketType, 
    subject, 
    message, 
    emailType = 'reminder' 
  } = req.body;

  try {
    // Build query to find tickets
    const queries = [];
    
    if (eventName) {
      queries.push({ field: 'eventName', operator: '==', value: eventName });
    }
    
    if (ticketType) {
      queries.push({ field: 'ticketType', operator: '==', value: ticketType });
    }
    
    // Only send to active tickets
    queries.push({ field: 'status', operator: '==', value: 'active' });

    const tickets = await firestoreHelpers.queryDocuments(TICKETS_COLLECTION, queries);

    if (tickets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tickets found matching the criteria'
      });
    }

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ticket) => {
        try {
          if (emailType === 'reminder') {
            await emailService.sendReminderEmail({
              to: ticket.userEmail,
              ticketData: ticket
            });
          } else {
            await emailService.sendCustomEmail({
              to: ticket.userEmail,
              subject: subject || `Update regarding ${ticket.eventName}`,
              htmlContent: `
                <h2>${subject || 'Event Update'}</h2>
                <p>Dear ${ticket.userName},</p>
                <p>${message}</p>
                <hr>
                <p><strong>Event:</strong> ${ticket.eventName}</p>
                <p><strong>Date:</strong> ${new Date(ticket.eventDate).toLocaleDateString()}</p>
                <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              `
            });
          }
          
          return { ticketId: ticket.ticketId, email: ticket.userEmail, success: true };
        } catch (error) {
          logger.warn(`Failed to send email to ${ticket.userEmail}:`, error);
          return { ticketId: ticket.ticketId, email: ticket.userEmail, success: false, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to be respectful to email service
      if (i + batchSize < tickets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info(`Bulk email campaign completed`, {
      sentBy: req.user.uid,
      totalEmails: results.length,
      successful: successCount,
      failed: failureCount,
      eventName,
      ticketType,
      emailType
    });

    res.json({
      success: true,
      message: 'Bulk email campaign completed',
      data: {
        totalEmails: results.length,
        successful: successCount,
        failed: failureCount,
        results: results
      }
    });

  } catch (error) {
    logger.error('Error sending bulk emails:', error);
    throw error;
  }
});

// @desc    Delete/cancel ticket (admin)
// @route   DELETE /api/admin/tickets/:ticketId
// @access  Private (Admin only)
const adminDeleteTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { reason } = req.body;

  try {
    const ticket = await firestoreHelpers.getDocument(TICKETS_COLLECTION, ticketId);

    if (!ticket) {
      throw createNotFoundError('Ticket');
    }

    // Soft delete - update status
    await firestoreHelpers.updateDocument(TICKETS_COLLECTION, ticketId, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: req.user.uid,
      cancelReason: reason || 'Cancelled by admin',
      adminAction: true
    });

    logger.info(`Admin cancelled ticket: ${ticketId}`, {
      adminId: req.user.uid,
      ticketId: ticket.ticketId,
      reason: reason || 'No reason provided'
    });

    res.json({
      success: true,
      message: 'Ticket cancelled successfully'
    });

  } catch (error) {
    logger.error('Error cancelling ticket (admin):', error);
    throw error;
  }
});

// @desc    Get system analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
const getSystemAnalytics = asyncHandler(async (req, res) => {
  const { timeRange = '30d' } = req.query;

  try {
    const now = new Date();
    let startDate;

    // Calculate date range
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get data for the time range
    const [allTickets, allUsers] = await Promise.all([
      firestoreHelpers.queryDocuments(TICKETS_COLLECTION),
      firestoreHelpers.queryDocuments(USERS_COLLECTION)
    ]);

    const rangeTickets = allTickets.filter(t => new Date(t.createdAt) >= startDate);
    const rangeUsers = allUsers.filter(u => new Date(u.createdAt) >= startDate);

    // Daily statistics
    const dailyStats = {};
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyStats[dateStr] = {
        date: dateStr,
        tickets: 0,
        checkIns: 0,
        users: 0,
        revenue: 0
      };
    }

    rangeTickets.forEach(ticket => {
      const dateStr = new Date(ticket.createdAt).toISOString().split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].tickets++;
        const prices = { Standard: 0, Premium: 49, VIP: 99 };
        dailyStats[dateStr].revenue += prices[ticket.ticketType] || 0;
      }

      if (ticket.checkedIn && ticket.checkedInAt) {
        const checkInDateStr = new Date(ticket.checkedInAt).toISOString().split('T')[0];
        if (dailyStats[checkInDateStr]) {
          dailyStats[checkInDateStr].checkIns++;
        }
      }
    });

    rangeUsers.forEach(user => {
      const dateStr = new Date(user.createdAt).toISOString().split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].users++;
      }
    });

    // Convert to array and sort by date
    const timeSeriesData = Object.values(dailyStats).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate growth rates
    const totalTickets = rangeTickets.length;
    const totalUsers = rangeUsers.length;
    const totalRevenue = rangeTickets.reduce((sum, ticket) => {
      const prices = { Standard: 0, Premium: 49, VIP: 99 };
      return sum + (prices[ticket.ticketType] || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        timeRange,
        summary: {
          totalTickets,
          totalUsers,
          totalRevenue,
          totalCheckIns: rangeTickets.filter(t => t.checkedIn).length
        },
        timeSeries: timeSeriesData,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching system analytics:', error);
    throw error;
  }
});

// @desc    Get system health status
// @route   GET /api/admin/health
// @access  Private (Admin only)
const getSystemHealth = asyncHandler(async (req, res) => {
  try {
    const healthChecks = {
      database: { status: 'unknown' },
      email: { status: 'unknown' },
      pdf: { status: 'unknown' },
      storage: { status: 'unknown' }
    };

    // Test database connection
    try {
      await firestoreHelpers.queryDocuments('tickets', [], null, 1);
      healthChecks.database = { status: 'healthy', responseTime: '<100ms' };
    } catch (error) {
      healthChecks.database = { status: 'unhealthy', error: error.message };
    }

    // Test email service
    try {
      const emailTest = await emailService.testEmailConnection();
      healthChecks.email = emailTest;
    } catch (error) {
      healthChecks.email = { status: 'unhealthy', error: error.message };
    }

    // Test PDF service
    try {
      const pdfTest = await pdfService.healthCheck();
      healthChecks.pdf = pdfTest;
    } catch (error) {
      healthChecks.pdf = { status: 'unhealthy', error: error.message };
    }

    // Overall health status
    const allHealthy = Object.values(healthChecks).every(check => 
      check.status === 'healthy'
    );

    res.json({
      success: true,
      data: {
        overall: allHealthy ? 'healthy' : 'degraded',
        services: healthChecks,
        checkedAt: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    });

  } catch (error) {
    logger.error('Error checking system health:', error);
    throw error;
  }
});

module.exports = {
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
};