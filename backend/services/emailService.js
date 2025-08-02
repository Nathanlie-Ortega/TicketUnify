const fs = require('fs');
const path = require('path');

// Mock Email Service - Perfect for testing without real email setup
const sendTicketEmail = async (ticketData) => {
  try {
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create email content
    const emailContent = {
      to: ticketData.email,
      from: 'noreply@ticketunify.com',
      subject: `Your Ticket for ${ticketData.eventName}`,
      html: `
        <h2>🎫 Your Ticket is Ready!</h2>
        <p>Dear ${ticketData.fullName},</p>
        <p>Your ticket for <strong>${ticketData.eventName}</strong> has been confirmed.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📅 Event Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Event:</strong> ${ticketData.eventName}</li>
            <li><strong>Date:</strong> ${ticketData.eventDate}</li>
            <li><strong>Location:</strong> ${ticketData.location || 'TBA'}</li>
            <li><strong>Ticket Type:</strong> ${ticketData.ticketType}</li>
            <li><strong>Ticket ID:</strong> ${ticketData.ticketId}</li>
          </ul>
        </div>
        
        <p>🔗 <strong>QR Code:</strong> ${ticketData.qrCode ? 'Included' : 'Will be generated'}</p>
        <p>📱 Please save this email and show your QR code at the event entrance.</p>
        
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          Best regards,<br>
          <strong>TicketUnify Team</strong><br>
          🌐 <a href="http://localhost:3000">Visit TicketUnify</a>
        </p>
      `,
      text: `
        Your Ticket for ${ticketData.eventName}
        
        Dear ${ticketData.fullName},
        
        Your ticket has been confirmed!
        
        Event Details:
        - Event: ${ticketData.eventName}
        - Date: ${ticketData.eventDate}
        - Location: ${ticketData.location || 'TBA'}
        - Ticket Type: ${ticketData.ticketType}
        - Ticket ID: ${ticketData.ticketId}
        
        Please keep this confirmation for your records.
        
        Best regards,
        TicketUnify Team
      `
    };
    
    // Log the email (simulating sending)
    console.log('\n📧 ================ EMAIL SENT ================');
    console.log('📬 To:', emailContent.to);
    console.log('📋 Subject:', emailContent.subject);
    console.log('✅ Status: Successfully sent (MOCK)');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🎫 Ticket ID:', ticketData.ticketId);
    console.log('👤 Recipient:', ticketData.fullName);
    console.log('🎪 Event:', ticketData.eventName);
    console.log('===============================================\n');
    
    // Optionally save email to file for debugging
    if (process.env.NODE_ENV === 'development') {
      const emailLog = {
        timestamp: new Date().toISOString(),
        to: emailContent.to,
        subject: emailContent.subject,
        ticketId: ticketData.ticketId,
        eventName: ticketData.eventName,
        content: emailContent.html
      };
      
      // Create logs directory if it doesn't exist
      const logsDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Save email log
      const logFile = path.join(logsDir, 'emails.log');
      fs.appendFileSync(logFile, JSON.stringify(emailLog, null, 2) + '\n\n');
    }
    
    // Return success (simulating real email service response)
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient: ticketData.email,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Mock Email Service Error:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
};

// Send welcome email for new users
const sendWelcomeEmail = async (userData) => {
  try {
    console.log('\n📧 ============= WELCOME EMAIL SENT =============');
    console.log('📬 To:', userData.email);
    console.log('👤 Name:', userData.fullName);
    console.log('✅ Status: Successfully sent (MOCK)');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('==============================================\n');
    
    return {
      success: true,
      messageId: `welcome_${Date.now()}`,
      recipient: userData.email
    };
  } catch (error) {
    console.error('❌ Welcome Email Error:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    console.log('\n📧 ========== PASSWORD RESET EMAIL SENT ==========');
    console.log('📬 To:', email);
    console.log('🔑 Reset Token:', resetToken);
    console.log('✅ Status: Successfully sent (MOCK)');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('================================================\n');
    
    return {
      success: true,
      messageId: `reset_${Date.now()}`,
      recipient: email
    };
  } catch (error) {
    console.error('❌ Password Reset Email Error:', error);
    throw error;
  }
};

// Check email service health
const checkEmailService = async () => {
  return {
    status: 'healthy',
    service: 'mock-email-service',
    timestamp: new Date().toISOString(),
    description: 'Mock email service for development and testing'
  };
};

module.exports = {
  sendTicketEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  checkEmailService
};