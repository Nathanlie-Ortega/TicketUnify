// backend/routes/email.js - Updated with proper ticket email endpoint
const express = require('express');
const router = express.Router();
const { sendTicketEmail, sendWelcomeEmail, sendPasswordResetEmail, checkEmailService } = require('../services/emailService');

// Health check route
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await checkEmailService();
    res.json({
      success: true,
      message: 'Email service health check',
      ...healthStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email service health check failed',
      error: error.message
    });
  }
});

// Send ticket email - THIS IS WHAT YOUR FRONTEND CALLS
router.post('/send-ticket', async (req, res) => {
  try {
    console.log('📧 Ticket email route hit!');
    console.log('📨 Request body:', JSON.stringify(req.body, null, 2));
    
    const { ticketData, recipients } = req.body;
    
    // Validate required ticket data
    if (!ticketData) {
      return res.status(400).json({
        success: false,
        message: 'Ticket data is required'
      });
    }
    
    // Validate required fields
    const requiredFields = ['ticketId', 'fullName', 'email', 'eventName'];
    const missingFields = requiredFields.filter(field => !ticketData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    console.log('✅ Ticket data validation passed');
    console.log('🎫 Sending email for ticket:', ticketData.ticketId);
    console.log('👤 Recipient:', ticketData.fullName);
    console.log('🎪 Event:', ticketData.eventName);
    
    // Send the ticket email
    const result = await sendTicketEmail(ticketData, recipients);
    
    console.log('✅ Ticket email sent successfully:', result);
    
    res.json({
      success: true,
      message: 'Ticket email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error sending ticket email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send ticket email',
      error: error.message
    });
  }
});

// Simple test email route (keep for testing)
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test email route hit!');
    
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }
    
    // Create test ticket data
    const testTicketData = {
      ticketId: 'TEST-' + Date.now(),
      fullName: 'Test User',
      email: email,
      eventName: 'SendGrid Test Event',
      eventDate: new Date().toISOString().split('T')[0],
      location: 'Dallas, TX',
      ticketType: 'Standard'
    };
    
    console.log('🧪 Sending test ticket email to:', email);
    const result = await sendTicketEmail(testTicketData);
    
    res.json({
      success: true,
      message: 'Test ticket email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
});

// Send welcome email
router.post('/welcome', async (req, res) => {
  try {
    const { userData } = req.body;
    
    if (!userData || !userData.email || !userData.fullName) {
      return res.status(400).json({
        success: false,
        message: 'User data with email and fullName is required'
      });
    }
    
    const result = await sendWelcomeEmail(userData);
    
    res.json({
      success: true,
      message: 'Welcome email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    });
  }
});

// Send password reset email
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken } = req.body;
    
    if (!email || !resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Email and reset token are required'
      });
    }
    
    const result = await sendPasswordResetEmail(email, resetToken);
    
    res.json({
      success: true,
      message: 'Password reset email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      error: error.message
    });
  }
});

module.exports = router;