const express = require('express');
const router = express.Router();
const { sendWelcomeEmail, sendTicketEmail } = require('../services/emailService');
const { generateTicketPDF } = require('../services/pdfService');

// Health check route
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Email service is running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email service health check failed',
      error: error.message
    });
  }
});

// Send ticket email with PDF
router.post('/send-ticket', async (req, res) => {
  try {
    console.log(' Ticket email route hit!');
    console.log(' Request body keys:', Object.keys(req.body));
    
    const { ticketData, pdfBase64 } = req.body;
    
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
    
    console.log(' Ticket data validation passed');
    console.log(' Ticket ID:', ticketData.ticketId);
    console.log(' Recipient:', ticketData.email);
    console.log(' Event:', ticketData.eventName);
    
    let pdfBuffer;
    
    // Use provided PDF if available, otherwise generate simple one
    if (pdfBase64) {
      console.log(' Using provided PDF from frontend');
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
    } else {
      console.log(' Generating fallback PDF');
      const { generateTicketPDF } = require('../services/pdfService');
      pdfBuffer = await generateTicketPDF(ticketData);
    }
    
    console.log(' PDF ready, sending email...');
    
    // Send the ticket email with PDF
    const result = await sendTicketEmail(ticketData.email, ticketData, pdfBuffer);
    
    console.log(' Ticket email sent successfully');
    
    res.json({
      success: true,
      message: 'Ticket email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error(' Error sending ticket email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send ticket email',
      error: error.message
    });
  }
});

// Send welcome email
router.post('/send-welcome', async (req, res) => {
  try {
    console.log(' Welcome email route hit!');
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
    }
    
    console.log(' Sending welcome email to:', email);
    const result = await sendWelcomeEmail(email, name);
    
    res.json({
      success: true,
      message: 'Welcome email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error(' Error sending welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    });
  }
});

// Test email route (for quick testing)
router.post('/test', async (req, res) => {
  try {
    console.log(' Test email route hit!');
    
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
      eventName: 'Test Event',
      eventDate: new Date().toISOString().split('T')[0],
      eventTime: '14:00',
      location: 'Dallas, TX',
      ticketType: 'Standard'
    };
    
    console.log(' Sending test ticket email to:', email);
    
    // Generate PDF
    const pdfBuffer = await generateTicketPDF(testTicketData);
    
    // Send email
    const result = await sendTicketEmail(email, testTicketData, pdfBuffer);
    
    res.json({
      success: true,
      message: 'Test ticket email sent successfully',
      data: result
    });
    
  } catch (error) {
    console.error(' Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
});

module.exports = router;