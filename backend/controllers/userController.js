// controllers/userController.js
const { firestoreHelpers, getUserByUid, setCustomUserClaims } = require('../utils/firebase-admin');
const { asyncHandler, createNotFoundError, createPermissionError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const USERS_COLLECTION = 'users';

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  try {
    // Get user from Firebase Auth
    const firebaseUser = await getUserByUid(req.user.uid);
    
    // Try to get additional user data from Firestore
    let userData = await firestoreHelpers.getDocument(USERS_COLLECTION, req.user.uid);
    
    // If no user data in Firestore, create it
    if (!userData) {
      userData = {
        uid: req.user.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || req.user.name,
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL || null,
        disabled: firebaseUser.disabled || false,
        customClaims: firebaseUser.customClaims || {},
        lastLoginAt: new Date(),
        preferences: {
          emailNotifications: true,
          marketingEmails: false,
          theme: 'light'
        }
      };
      
      await firestoreHelpers.addDocument(USERS_COLLECTION, userData);
      userData.id = req.user.uid;
    }

    // Update last login
    await firestoreHelpers.updateDocument(USERS_COLLECTION, req.user.uid, {
      lastLoginAt: new Date()
    });

    res.json({
      success: true,
      data: {
        user: {
          ...userData,
          id: req.user.uid
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const { displayName, preferences, additionalInfo } = req.body;

  try {
    const updateData = {};
    
    if (displayName) {
      updateData.displayName = displayName.trim();
    }
    
    if (preferences) {
      updateData.preferences = {
        emailNotifications: preferences.emailNotifications ?? true,
        marketingEmails: preferences.marketingEmails ?? false,
        theme: preferences.theme || 'light'
      };
    }
    
    if (additionalInfo) {
      updateData.additionalInfo = additionalInfo;
    }

    // Update in Firestore
    await firestoreHelpers.updateDocument(USERS_COLLECTION, req.user.uid, updateData);
    
    // Get updated user data
    const updatedUser = await firestoreHelpers.getDocument(USERS_COLLECTION, req.user.uid);

    logger.info(`User profile updated: ${req.user.uid}`, {
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          ...updatedUser,
          id: req.user.uid
        }
      }
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
});

// @desc    Delete user account
// @route   DELETE /api/users/profile
// @access  Private
const deleteUserAccount = asyncHandler(async (req, res) => {
  try {
    // Soft delete - mark as deleted but keep data for audit
    await firestoreHelpers.updateDocument(USERS_COLLECTION, req.user.uid, {
      deleted: true,
      deletedAt: new Date(),
      status: 'deleted'
    });

    // Also update any active tickets to cancelled
    const userTickets = await firestoreHelpers.queryDocuments(
      'tickets',
      [
        { field: 'userId', operator: '==', value: req.user.uid },
        { field: 'status', operator: '==', value: 'active' }
      ]
    );

    // Cancel all active tickets
    const cancelPromises = userTickets.map(ticket => 
      firestoreHelpers.updateDocument('tickets', ticket.id, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: req.user.uid,
        cancelReason: 'Account deletion'
      })
    );

    await Promise.all(cancelPromises);

    logger.info(`User account deleted: ${req.user.uid}`, {
      ticketsCancelled: userTickets.length
    });

    res.json({
      success: true,
      message: 'Account deleted successfully',
      data: {
        ticketsCancelled: userTickets.length
      }
    });

  } catch (error) {
    logger.error('Error deleting user account:', error);
    throw error;
  }
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
const getUserStats = asyncHandler(async (req, res) => {
  try {
    // Get user's tickets
    const userTickets = await firestoreHelpers.queryDocuments(
      'tickets',
      [{ field: 'userId', operator: '==', value: req.user.uid }]
    );

    // Calculate statistics
    const stats = {
      totalTickets: userTickets.length,
      activeTickets: userTickets.filter(t => t.status === 'active').length,
      checkedInTickets: userTickets.filter(t => t.checkedIn).length,
      cancelledTickets: userTickets.filter(t => t.status === 'cancelled').length,
      ticketsByType: {
        Standard: userTickets.filter(t => t.ticketType === 'Standard').length,
        Premium: userTickets.filter(t => t.ticketType === 'Premium').length,
        VIP: userTickets.filter(t => t.ticketType === 'VIP').length
      },
      upcomingEvents: userTickets.filter(t => 
        t.status === 'active' && new Date(t.eventDate) > new Date()
      ).length,
      pastEvents: userTickets.filter(t => 
        new Date(t.eventDate) < new Date()
      ).length
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    throw error;
  }
});

// @desc    Get user's tickets
// @route   GET /api/users/tickets
// @access  Private
const getUserTickets = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    upcoming = false 
  } = req.query;

  try {
    // Build query
    const queries = [
      { field: 'userId', operator: '==', value: req.user.uid }
    ];

    if (status) {
      queries.push({ field: 'status', operator: '==', value: status });
    }

    // Get tickets
    let tickets = await firestoreHelpers.queryDocuments(
      'tickets',
      queries,
      { field: 'eventDate', direction: 'desc' }
    );

    // Filter for upcoming events if requested
    if (upcoming === 'true') {
      tickets = tickets.filter(ticket => 
        new Date(ticket.eventDate) > new Date()
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
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching user tickets:', error);
    throw error;
  }
});

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
const updateUserPreferences = asyncHandler(async (req, res) => {
  const { emailNotifications, marketingEmails, theme, language } = req.body;

  try {
    const preferences = {
      emailNotifications: emailNotifications ?? true,
      marketingEmails: marketingEmails ?? false,
      theme: theme || 'light',
      language: language || 'en'
    };

    await firestoreHelpers.updateDocument(USERS_COLLECTION, req.user.uid, {
      preferences,
      preferencesUpdatedAt: new Date()
    });

    logger.info(`User preferences updated: ${req.user.uid}`, preferences);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences }
    });

  } catch (error) {
    logger.error('Error updating user preferences:', error);
    throw error;
  }
});

// @desc    Send user welcome email
// @route   POST /api/users/welcome-email
// @access  Private
const sendWelcomeEmail = asyncHandler(async (req, res) => {
  try {
    const userData = await firestoreHelpers.getDocument(USERS_COLLECTION, req.user.uid);
    
    if (!userData) {
      throw createNotFoundError('User');
    }

    await emailService.sendWelcomeEmail({
      to: req.user.email,
      userName: userData.displayName || req.user.name,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
    });

    logger.info(`Welcome email sent to user: ${req.user.uid}`);

    res.json({
      success: true,
      message: 'Welcome email sent successfully'
    });

  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
});

// @desc    Export user data (GDPR compliance)
// @route   GET /api/users/export
// @access  Private
const exportUserData = asyncHandler(async (req, res) => {
  try {
    // Get user data
    const userData = await firestoreHelpers.getDocument(USERS_COLLECTION, req.user.uid);
    const userTickets = await firestoreHelpers.queryDocuments(
      'tickets',
      [{ field: 'userId', operator: '==', value: req.user.uid }]
    );

    // Compile all user data
    const exportData = {
      user: userData,
      tickets: userTickets,
      exportedAt: new Date().toISOString(),
      exportType: 'full'
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user.uid}.json"`);

    logger.info(`User data exported: ${req.user.uid}`, {
      ticketsCount: userTickets.length
    });

    res.json(exportData);

  } catch (error) {
    logger.error('Error exporting user data:', error);
    throw error;
  }
});

// @desc    Check if user is admin
// @route   GET /api/users/admin-status
// @access  Private
const checkAdminStatus = asyncHandler(async (req, res) => {
  const isAdmin = req.user.customClaims?.admin === true || 
                 req.user.customClaims?.role === 'admin' ||
                 req.user.email === process.env.ADMIN_EMAIL;

  res.json({
    success: true,
    data: {
      isAdmin,
      customClaims: req.user.customClaims || {},
      email: req.user.email
    }
  });
});

// @desc    Get user activity log
// @route   GET /api/users/activity
// @access  Private
const getUserActivity = asyncHandler(async (req, res) => {
  try {
    // This would typically come from a separate activity log collection
    // For now, we'll derive activity from tickets and user updates
    
    const userTickets = await firestoreHelpers.queryDocuments(
      'tickets',
      [{ field: 'userId', operator: '==', value: req.user.uid }],
      { field: 'createdAt', direction: 'desc' },
      20
    );

    const activities = userTickets.map(ticket => ({
      type: 'ticket_created',
      description: `Created ticket for ${ticket.eventName}`,
      timestamp: ticket.createdAt,
      metadata: {
        ticketId: ticket.ticketId,
        eventName: ticket.eventName,
        ticketType: ticket.ticketType
      }
    }));

    // Add check-in activities
    const checkedInTickets = userTickets.filter(t => t.checkedIn);
    checkedInTickets.forEach(ticket => {
      activities.push({
        type: 'ticket_checkin',
        description: `Checked in to ${ticket.eventName}`,
        timestamp: ticket.checkedInAt,
        metadata: {
          ticketId: ticket.ticketId,
          eventName: ticket.eventName
        }
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: {
        activities: activities.slice(0, 20) // Limit to 20 most recent
      }
    });

  } catch (error) {
    logger.error('Error fetching user activity:', error);
    throw error;
  }
});

module.exports = {
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
};