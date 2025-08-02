// controllers/analyticsController.js
const { firestoreHelpers } = require('../utils/firebase-admin');
const { asyncHandler, createPermissionError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const TICKETS_COLLECTION = 'tickets';
const USERS_COLLECTION = 'users';

// @desc    Get event analytics
// @route   GET /api/analytics/events
// @access  Private (Admin only)
const getEventAnalytics = asyncHandler(async (req, res) => {
  const { timeRange = '30d', eventName } = req.query;

  try {
    const startTime = Date.now();
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
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
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get tickets data
    let tickets = await firestoreHelpers.queryDocuments(
      TICKETS_COLLECTION,
      [{ field: 'createdAt', operator: '>=', value: startDate }]
    );

    // Filter by event name if specified
    if (eventName) {
      tickets = tickets.filter(ticket => 
        ticket.eventName.toLowerCase().includes(eventName.toLowerCase())
      );
    }

    // Group tickets by event
    const eventStats = {};
    tickets.forEach(ticket => {
      const event = ticket.eventName;
      if (!eventStats[event]) {
        eventStats[event] = {
          eventName: event,
          totalTickets: 0,
          checkedIn: 0,
          cancelled: 0,
          revenue: 0,
          ticketTypes: { Standard: 0, Premium: 0, VIP: 0 },
          checkInRate: 0,
          upcomingEvent: new Date(ticket.eventDate) > now
        };
      }

      eventStats[event].totalTickets++;
      
      if (ticket.checkedIn) {
        eventStats[event].checkedIn++;
      }
      
      if (ticket.status === 'cancelled') {
        eventStats[event].cancelled++;
      }

      // Calculate revenue (simplified pricing)
      const prices = { Standard: 0, Premium: 49, VIP: 99 };
      eventStats[event].revenue += prices[ticket.ticketType] || 0;
      
      // Count ticket types
      if (eventStats[event].ticketTypes[ticket.ticketType] !== undefined) {
        eventStats[event].ticketTypes[ticket.ticketType]++;
      }
    });

    // Calculate check-in rates
    Object.values(eventStats).forEach(event => {
      if (event.totalTickets > 0) {
        event.checkInRate = ((event.checkedIn / event.totalTickets) * 100).toFixed(1);
      }
    });

    // Convert to array and sort by total tickets
    const events = Object.values(eventStats).sort((a, b) => b.totalTickets - a.totalTickets);

    // Calculate summary stats
    const summary = {
      totalEvents: events.length,
      totalTickets: tickets.length,
      totalRevenue: events.reduce((sum, event) => sum + event.revenue, 0),
      totalCheckedIn: tickets.filter(t => t.checkedIn).length,
      averageCheckInRate: events.length > 0 ? 
        (events.reduce((sum, event) => sum + parseFloat(event.checkInRate), 0) / events.length).toFixed(1) : 0,
      upcomingEvents: events.filter(event => event.upcomingEvent).length
    };

    logger.logPerformance('event_analytics', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        summary,
        events,
        timeRange,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching event analytics:', error);
    throw error;
  }
});

// @desc    Get ticket trends over time
// @route   GET /api/analytics/trends
// @access  Private (Admin only)
const getTicketTrends = asyncHandler(async (req, res) => {
  const { timeRange = '30d', granularity = 'day' } = req.query;

  try {
    const startTime = Date.now();
    
    // Calculate date range
    const now = new Date();
    let startDate;
    let dateFormat;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFormat = 'day';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFormat = granularity === 'week' ? 'week' : 'day';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateFormat = 'week';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        dateFormat = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFormat = 'day';
    }

    // Get tickets and users data
    const [tickets, users] = await Promise.all([
      firestoreHelpers.queryDocuments(
        TICKETS_COLLECTION,
        [{ field: 'createdAt', operator: '>=', value: startDate }]
      ),
      firestoreHelpers.queryDocuments(
        USERS_COLLECTION,
        [{ field: 'createdAt', operator: '>=', value: startDate }]
      )
    ]);

    // Helper function to format date based on granularity
    const formatDate = (date, format) => {
      const d = new Date(date);
      switch (format) {
        case 'day':
          return d.toISOString().split('T')[0];
        case 'week':
          const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
          return weekStart.toISOString().split('T')[0];
        case 'month':
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        default:
          return d.toISOString().split('T')[0];
      }
    };

    // Initialize time series data
    const timeSeriesData = {};
    const current = new Date(startDate);
    
    while (current <= now) {
      const key = formatDate(current, dateFormat);
      timeSeriesData[key] = {
        date: key,
        tickets: 0,
        checkIns: 0,
        users: 0,
        revenue: 0,
        ticketTypes: { Standard: 0, Premium: 0, VIP: 0 }
      };
      
      // Increment based on granularity
      switch (dateFormat) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    // Populate ticket data
    tickets.forEach(ticket => {
      const ticketDate = formatDate(ticket.createdAt, dateFormat);
      if (timeSeriesData[ticketDate]) {
        timeSeriesData[ticketDate].tickets++;
        timeSeriesData[ticketDate].ticketTypes[ticket.ticketType]++;
        
        const prices = { Standard: 0, Premium: 49, VIP: 99 };
        timeSeriesData[ticketDate].revenue += prices[ticket.ticketType] || 0;
      }

      // Count check-ins
      if (ticket.checkedIn && ticket.checkedInAt) {
        const checkInDate = formatDate(ticket.checkedInAt, dateFormat);
        if (timeSeriesData[checkInDate]) {
          timeSeriesData[checkInDate].checkIns++;
        }
      }
    });

    // Populate user data
    users.forEach(user => {
      const userDate = formatDate(user.createdAt, dateFormat);
      if (timeSeriesData[userDate]) {
        timeSeriesData[userDate].users++;
      }
    });

    // Convert to array and sort by date
    const trends = Object.values(timeSeriesData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate growth rates
    const calculateGrowthRate = (data, field) => {
      if (data.length < 2) return 0;
      const current = data[data.length - 1][field];
      const previous = data[data.length - 2][field];
      return previous > 0 ? (((current - previous) / previous) * 100).toFixed(1) : 0;
    };

    const growthRates = {
      tickets: calculateGrowthRate(trends, 'tickets'),
      checkIns: calculateGrowthRate(trends, 'checkIns'),
      users: calculateGrowthRate(trends, 'users'),
      revenue: calculateGrowthRate(trends, 'revenue')
    };

    logger.logPerformance('ticket_trends', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        trends,
        growthRates,
        timeRange,
        granularity: dateFormat,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching ticket trends:', error);
    throw error;
  }
});

// @desc    Get user engagement analytics
// @route   GET /api/analytics/engagement
// @access  Private (Admin only)
const getUserEngagement = asyncHandler(async (req, res) => {
  const { timeRange = '30d' } = req.query;

  try {
    const startTime = Date.now();
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
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

    // Get users and tickets data
    const [allUsers, rangeTickets] = await Promise.all([
      firestoreHelpers.queryDocuments(USERS_COLLECTION),
      firestoreHelpers.queryDocuments(
        TICKETS_COLLECTION,
        [{ field: 'createdAt', operator: '>=', value: startDate }]
      )
    ]);

    // Analyze user engagement
    const userEngagement = {};
    
    // Initialize engagement data for all users
    allUsers.forEach(user => {
      userEngagement[user.uid] = {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName || 'Anonymous',
        totalTickets: 0,
        checkedInTickets: 0,
        cancelledTickets: 0,
        revenue: 0,
        lastActivity: user.lastLoginAt || user.createdAt,
        engagementScore: 0,
        isActive: false
      };
    });

    // Populate ticket data
    rangeTickets.forEach(ticket => {
      if (ticket.userId && userEngagement[ticket.userId]) {
        const user = userEngagement[ticket.userId];
        user.totalTickets++;
        user.isActive = true;
        
        if (ticket.checkedIn) {
          user.checkedInTickets++;
        }
        
        if (ticket.status === 'cancelled') {
          user.cancelledTickets++;
        }
        
        // Calculate revenue
        const prices = { Standard: 0, Premium: 49, VIP: 99 };
        user.revenue += prices[ticket.ticketType] || 0;
        
        // Update last activity if ticket creation is more recent
        if (new Date(ticket.createdAt) > new Date(user.lastActivity)) {
          user.lastActivity = ticket.createdAt;
        }
      }
    });

    // Calculate engagement scores
    Object.values(userEngagement).forEach(user => {
      let score = 0;
      
      // Points for tickets created
      score += user.totalTickets * 10;
      
      // Points for checking in
      score += user.checkedInTickets * 5;
      
      // Penalty for cancellations
      score -= user.cancelledTickets * 3;
      
      // Points for revenue generation
      score += Math.floor(user.revenue / 10);
      
      // Recent activity bonus
      const daysSinceActivity = (now - new Date(user.lastActivity)) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= 7) score += 20;
      else if (daysSinceActivity <= 30) score += 10;
      
      user.engagementScore = Math.max(0, score);
    });

    // Filter and sort active users
    const activeUsers = Object.values(userEngagement)
      .filter(user => user.isActive)
      .sort((a, b) => b.engagementScore - a.engagementScore);

    // Calculate summary statistics
    const summary = {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      averageTicketsPerUser: activeUsers.length > 0 ? 
        (activeUsers.reduce((sum, user) => sum + user.totalTickets, 0) / activeUsers.length).toFixed(1) : 0,
      averageEngagementScore: activeUsers.length > 0 ? 
        (activeUsers.reduce((sum, user) => sum + user.engagementScore, 0) / activeUsers.length).toFixed(1) : 0,
      topPerformer: activeUsers[0] || null
    };

    // Engagement segments
    const segments = {
      highly_engaged: activeUsers.filter(user => user.engagementScore >= 50).length,
      moderately_engaged: activeUsers.filter(user => user.engagementScore >= 20 && user.engagementScore < 50).length,
      low_engaged: activeUsers.filter(user => user.engagementScore > 0 && user.engagementScore < 20).length,
      inactive: allUsers.length - activeUsers.length
    };

    logger.logPerformance('user_engagement', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        summary,
        segments,
        topUsers: activeUsers.slice(0, 10),
        timeRange,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching user engagement analytics:', error);
    throw error;
  }
});

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Private (Admin only)
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { timeRange = '30d', breakdown = 'daily' } = req.query;

  try {
    const startTime = Date.now();
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
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
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get tickets data
    const tickets = await firestoreHelpers.queryDocuments(
      TICKETS_COLLECTION,
      [{ field: 'createdAt', operator: '>=', value: startDate }]
    );

    // Pricing structure
    const prices = { Standard: 0, Premium: 49, VIP: 99 };

    // Calculate revenue by ticket type
    const revenueByType = {
      Standard: { count: 0, revenue: 0 },
      Premium: { count: 0, revenue: 0 },
      VIP: { count: 0, revenue: 0 }
    };

    tickets.forEach(ticket => {
      const type = ticket.ticketType;
      const price = prices[type] || 0;
      
      revenueByType[type].count++;
      revenueByType[type].revenue += price;
    });

    // Calculate revenue over time
    const revenueTimeSeries = {};
    const formatDate = (date) => {
      switch (breakdown) {
        case 'daily':
          return new Date(date).toISOString().split('T')[0];
        case 'weekly':
          const d = new Date(date);
          const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
          return weekStart.toISOString().split('T')[0];
        case 'monthly':
          const month = new Date(date);
          return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        default:
          return new Date(date).toISOString().split('T')[0];
      }
    };

    tickets.forEach(ticket => {
      const dateKey = formatDate(ticket.createdAt);
      const revenue = prices[ticket.ticketType] || 0;
      
      if (!revenueTimeSeries[dateKey]) {
        revenueTimeSeries[dateKey] = {
          date: dateKey,
          revenue: 0,
          tickets: 0,
          byType: { Standard: 0, Premium: 0, VIP: 0 }
        };
      }
      
      revenueTimeSeries[dateKey].revenue += revenue;
      revenueTimeSeries[dateKey].tickets++;
      revenueTimeSeries[dateKey].byType[ticket.ticketType] += revenue;
    });

    // Convert to array and sort by date
    const timeSeries = Object.values(revenueTimeSeries).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate summary statistics
    const totalRevenue = Object.values(revenueByType).reduce((sum, type) => sum + type.revenue, 0);
    const totalTickets = Object.values(revenueByType).reduce((sum, type) => sum + type.count, 0);
    const averageRevenuePerTicket = totalTickets > 0 ? (totalRevenue / totalTickets).toFixed(2) : 0;

    // Calculate growth rate
    let growthRate = 0;
    if (timeSeries.length >= 2) {
      const current = timeSeries[timeSeries.length - 1].revenue;
      const previous = timeSeries[timeSeries.length - 2].revenue;
      growthRate = previous > 0 ? (((current - previous) / previous) * 100).toFixed(1) : 0;
    }

    const summary = {
      totalRevenue,
      totalTickets,
      averageRevenuePerTicket: parseFloat(averageRevenuePerTicket),
      growthRate: parseFloat(growthRate),
      topPerformingType: Object.entries(revenueByType)
        .sort(([,a], [,b]) => b.revenue - a.revenue)[0]?.[0] || 'Standard'
    };

    logger.logPerformance('revenue_analytics', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        summary,
        revenueByType,
        timeSeries,
        timeRange,
        breakdown,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching revenue analytics:', error);
    throw error;
  }
});

// @desc    Get real-time analytics dashboard
// @route   GET /api/analytics/realtime
// @access  Private (Admin only)
const getRealTimeAnalytics = asyncHandler(async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get recent data (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [recentTickets, recentCheckIns, allTickets] = await Promise.all([
      firestoreHelpers.queryDocuments(
        TICKETS_COLLECTION,
        [{ field: 'createdAt', operator: '>=', value: last24Hours }]
      ),
      firestoreHelpers.queryDocuments(
        TICKETS_COLLECTION,
        [{ field: 'checkedInAt', operator: '>=', value: lastHour }]
      ),
      firestoreHelpers.queryDocuments(TICKETS_COLLECTION, [], null, 100)
    ]);

    // Calculate real-time metrics
    const metrics = {
      ticketsLast24h: recentTickets.length,
      checkInsLastHour: recentCheckIns.length,
      activeSessions: recentTickets.filter(t => 
        new Date(t.createdAt) > new Date(Date.now() - 15 * 60 * 1000)
      ).length,
      totalTickets: allTickets.length,
      totalCheckedIn: allTickets.filter(t => t.checkedIn).length
    };

    // Recent activity feed
    const recentActivity = [...recentTickets, ...recentCheckIns]
      .sort((a, b) => new Date(b.createdAt || b.checkedInAt) - new Date(a.createdAt || a.checkedInAt))
      .slice(0, 10)
      .map(item => ({
        type: item.checkedInAt ? 'checkin' : 'ticket_created',
        userName: item.userName,
        eventName: item.eventName,
        timestamp: item.checkedInAt || item.createdAt,
        ticketType: item.ticketType
      }));

    // Current system status
    const systemStatus = {
      status: 'operational',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeConnections: metrics.activeSessions,
      lastUpdated: new Date().toISOString()
    };

    logger.logPerformance('realtime_analytics', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        metrics,
        recentActivity,
        systemStatus,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching real-time analytics:', error);
    throw error;
  }
});

module.exports = {
  getEventAnalytics,
  getTicketTrends,
  getUserEngagement,
  getRevenueAnalytics,
  getRealTimeAnalytics
};