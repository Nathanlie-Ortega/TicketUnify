// services/analyticsService.js
const { firestoreHelpers } = require('../utils/firebase-admin');
const logger = require('../utils/logger');

// Collections
const TICKETS_COLLECTION = 'tickets';
const USERS_COLLECTION = 'users';
const ANALYTICS_COLLECTION = 'analytics';

// @desc    Process and cache daily analytics
const processDailyAnalytics = async (date = new Date()) => {
  try {
    const startTime = Date.now();
    const dateStr = date.toISOString().split('T')[0];
    
    // Get data for the specific date
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const [dayTickets, dayUsers, allTickets] = await Promise.all([
      firestoreHelpers.queryDocuments(
        TICKETS_COLLECTION,
        [
          { field: 'createdAt', operator: '>=', value: startOfDay },
          { field: 'createdAt', operator: '<=', value: endOfDay }
        ]
      ),
      firestoreHelpers.queryDocuments(
        USERS_COLLECTION,
        [
          { field: 'createdAt', operator: '>=', value: startOfDay },
          { field: 'createdAt', operator: '<=', value: endOfDay }
        ]
      ),
      firestoreHelpers.queryDocuments(TICKETS_COLLECTION)
    ]);

    // Calculate daily metrics
    const analytics = {
      date: dateStr,
      tickets: {
        created: dayTickets.length,
        checkedIn: dayTickets.filter(t => t.checkedIn).length,
        cancelled: dayTickets.filter(t => t.status === 'cancelled').length,
        byType: {
          Standard: dayTickets.filter(t => t.ticketType === 'Standard').length,
          Premium: dayTickets.filter(t => t.ticketType === 'Premium').length,
          VIP: dayTickets.filter(t => t.ticketType === 'VIP').length
        }
      },
      users: {
        registered: dayUsers.length,
        active: dayUsers.filter(u => !u.deleted).length
      },
      revenue: {
        daily: calculateRevenue(dayTickets),
        total: calculateRevenue(allTickets)
      },
      events: calculateEventMetrics(dayTickets),
      engagement: calculateEngagementMetrics(dayTickets, dayUsers),
      processedAt: new Date(),
      processingTime: Date.now() - startTime
    };

    // Store analytics
    const analyticsId = `daily_${dateStr}`;
    await firestoreHelpers.updateDocument(ANALYTICS_COLLECTION, analyticsId, analytics);

    logger.logPerformance('daily_analytics_processing', Date.now() - startTime, {
      date: dateStr,
      ticketsProcessed: dayTickets.length,
      usersProcessed: dayUsers.length
    });

    return analytics;

  } catch (error) {
    logger.error('Error processing daily analytics:', error);
    throw error;
  }
};

// @desc    Calculate revenue from tickets
const calculateRevenue = (tickets) => {
  const prices = { Standard: 0, Premium: 49, VIP: 99 };
  
  return {
    total: tickets.reduce((sum, ticket) => sum + (prices[ticket.ticketType] || 0), 0),
    byType: {
      Standard: tickets.filter(t => t.ticketType === 'Standard').length * prices.Standard,
      Premium: tickets.filter(t => t.ticketType === 'Premium').length * prices.Premium,
      VIP: tickets.filter(t => t.ticketType === 'VIP').length * prices.VIP
    },
    averagePerTicket: tickets.length > 0 ? 
      tickets.reduce((sum, ticket) => sum + (prices[ticket.ticketType] || 0), 0) / tickets.length : 0
  };
};

// @desc    Calculate event-specific metrics
const calculateEventMetrics = (tickets) => {
  const eventStats = {};
  
  tickets.forEach(ticket => {
    const eventName = ticket.eventName;
    if (!eventStats[eventName]) {
      eventStats[eventName] = {
        name: eventName,
        tickets: 0,
        checkedIn: 0,
        revenue: 0,
        types: { Standard: 0, Premium: 0, VIP: 0 }
      };
    }
    
    eventStats[eventName].tickets++;
    if (ticket.checkedIn) eventStats[eventName].checkedIn++;
    
    const prices = { Standard: 0, Premium: 49, VIP: 99 };
    eventStats[eventName].revenue += prices[ticket.ticketType] || 0;
    eventStats[eventName].types[ticket.ticketType]++;
  });

  // Calculate check-in rates
  Object.values(eventStats).forEach(event => {
    event.checkInRate = event.tickets > 0 ? (event.checkedIn / event.tickets * 100).toFixed(1) : 0;
  });

  return {
    totalEvents: Object.keys(eventStats).length,
    events: Object.values(eventStats),
    topEvent: Object.values(eventStats).sort((a, b) => b.tickets - a.tickets)[0] || null
  };
};

// @desc    Calculate user engagement metrics
const calculateEngagementMetrics = (tickets, users) => {
  const userActivity = {};
  
  // Track user ticket activity
  tickets.forEach(ticket => {
    if (ticket.userId) {
      if (!userActivity[ticket.userId]) {
        userActivity[ticket.userId] = {
          tickets: 0,
          checkedIn: 0,
          revenue: 0
        };
      }
      
      userActivity[ticket.userId].tickets++;
      if (ticket.checkedIn) userActivity[ticket.userId].checkedIn++;
      
      const prices = { Standard: 0, Premium: 49, VIP: 99 };
      userActivity[ticket.userId].revenue += prices[ticket.ticketType] || 0;
    }
  });

  const activeUsers = Object.keys(userActivity).length;
  const totalUsers = users.length;
  
  return {
    activeUsers,
    totalUsers,
    engagementRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0,
    averageTicketsPerActiveUser: activeUsers > 0 ? 
      Object.values(userActivity).reduce((sum, user) => sum + user.tickets, 0) / activeUsers : 0,
    topUsers: Object.entries(userActivity)
      .map(([userId, activity]) => ({ userId, ...activity }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 5)
  };
};

// @desc    Get analytics for date range
const getAnalyticsRange = async (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const analyticsData = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const analyticsId = `daily_${dateStr}`;
      
      try {
        const dayAnalytics = await firestoreHelpers.getDocument(ANALYTICS_COLLECTION, analyticsId);
        if (dayAnalytics) {
          analyticsData.push(dayAnalytics);
        } else {
          // If analytics don't exist for this date, process them
          const processedAnalytics = await processDailyAnalytics(new Date(currentDate));
          analyticsData.push(processedAnalytics);
        }
      } catch (error) {
        logger.warn(`Failed to get analytics for ${dateStr}:`, error);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return analyticsData.sort((a, b) => new Date(a.date) - new Date(b.date));

  } catch (error) {
    logger.error('Error getting analytics range:', error);
    throw error;
  }
};

// @desc    Calculate growth rates
const calculateGrowthRates = (analyticsData, metric) => {
  if (analyticsData.length < 2) return { daily: 0, weekly: 0, monthly: 0 };
  
  const getValue = (data, path) => {
    return path.split('.').reduce((obj, key) => obj?.[key], data) || 0;
  };
  
  const latest = getValue(analyticsData[analyticsData.length - 1], metric);
  const previous = getValue(analyticsData[analyticsData.length - 2], metric);
  
  const dailyGrowth = previous > 0 ? ((latest - previous) / previous * 100).toFixed(1) : 0;
  
  // Weekly growth (if we have at least 7 days)
  let weeklyGrowth = 0;
  if (analyticsData.length >= 7) {
    const weekAgo = getValue(analyticsData[analyticsData.length - 7], metric);
    weeklyGrowth = weekAgo > 0 ? ((latest - weekAgo) / weekAgo * 100).toFixed(1) : 0;
  }
  
  // Monthly growth (if we have at least 30 days)
  let monthlyGrowth = 0;
  if (analyticsData.length >= 30) {
    const monthAgo = getValue(analyticsData[analyticsData.length - 30], metric);
    monthlyGrowth = monthAgo > 0 ? ((latest - monthAgo) / monthAgo * 100).toFixed(1) : 0;
  }
  
  return {
    daily: parseFloat(dailyGrowth),
    weekly: parseFloat(weeklyGrowth),
    monthly: parseFloat(monthlyGrowth)
  };
};

// @desc    Generate summary statistics
const generateSummaryStats = (analyticsData) => {
  if (analyticsData.length === 0) return null;
  
  const totals = analyticsData.reduce((acc, day) => {
    acc.tickets += day.tickets.created;
    acc.checkedIn += day.tickets.checkedIn;
    acc.users += day.users.registered;
    acc.revenue += day.revenue.daily.total;
    return acc;
  }, { tickets: 0, checkedIn: 0, users: 0, revenue: 0 });
  
  const averages = {
    ticketsPerDay: (totals.tickets / analyticsData.length).toFixed(1),
    usersPerDay: (totals.users / analyticsData.length).toFixed(1),
    revenuePerDay: (totals.revenue / analyticsData.length).toFixed(2),
    checkInRate: totals.tickets > 0 ? (totals.checkedIn / totals.tickets * 100).toFixed(1) : 0
  };
  
  // Find best and worst performing days
  const bestDay = analyticsData.reduce((best, day) => 
    day.tickets.created > best.tickets.created ? day : best
  );
  
  const worstDay = analyticsData.reduce((worst, day) => 
    day.tickets.created < worst.tickets.created ? day : worst
  );
  
  return {
    totals,
    averages,
    bestDay: { date: bestDay.date, tickets: bestDay.tickets.created },
    worstDay: { date: worstDay.date, tickets: worstDay.tickets.created },
    totalDays: analyticsData.length
  };
};

// @desc    Predict future trends (simple linear regression)
const predictTrends = (analyticsData, daysToPredict = 7) => {
  if (analyticsData.length < 7) return null;
  
  const tickets = analyticsData.map(day => day.tickets.created);
  const revenue = analyticsData.map(day => day.revenue.daily.total);
  
  const linearRegression = (values) => {
    const n = values.length;
    const x = values.map((_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  };
  
  const ticketTrend = linearRegression(tickets);
  const revenueTrend = linearRegression(revenue);
  
  const predictions = [];
  for (let i = 1; i <= daysToPredict; i++) {
    const futureIndex = analyticsData.length + i - 1;
    predictions.push({
      day: i,
      predictedTickets: Math.max(0, Math.round(ticketTrend.slope * futureIndex + ticketTrend.intercept)),
      predictedRevenue: Math.max(0, Math.round(revenueTrend.slope * futureIndex + revenueTrend.intercept))
    });
  }
  
  return {
    predictions,
    confidence: Math.min(analyticsData.length / 30, 1), // Higher confidence with more data
    trends: {
      tickets: ticketTrend.slope > 0 ? 'increasing' : 'decreasing',
      revenue: revenueTrend.slope > 0 ? 'increasing' : 'decreasing'
    }
  };
};

// @desc    Clean up old analytics data
const cleanupOldAnalytics = async (olderThanDays = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const oldAnalytics = await firestoreHelpers.queryDocuments(
      ANALYTICS_COLLECTION,
      [{ field: 'processedAt', operator: '<', value: cutoffDate }]
    );
    
    let deletedCount = 0;
    for (const analytics of oldAnalytics) {
      try {
        await firestoreHelpers.deleteDocument(ANALYTICS_COLLECTION, analytics.id);
        deletedCount++;
      } catch (error) {
        logger.warn(`Failed to delete analytics ${analytics.id}:`, error);
      }
    }
    
    logger.info('Analytics cleanup completed', {
      deletedCount,
      olderThanDays
    });
    
    return { deletedCount, olderThanDays };

  } catch (error) {
    logger.error('Error cleaning up old analytics:', error);
    throw error;
  }
};

// @desc    Health check for analytics service
const healthCheck = async () => {
  try {
    // Test basic analytics processing
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1); // Yesterday
    
    const startTime = Date.now();
    await processDailyAnalytics(testDate);
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      lastProcessed: testDate.toISOString().split('T')[0]
    };

  } catch (error) {
    logger.error('Analytics service health check failed:', error);
      return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

module.exports = {
  processDailyAnalytics,
  calculateRevenue,
  calculateEventMetrics,
  calculateEngagementMetrics,
  getAnalyticsRange,
  calculateGrowthRates,
  generateSummaryStats,
  predictTrends,
  cleanupOldAnalytics,
  healthCheck
};