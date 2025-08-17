// backend/services/emailService.js - SendGrid Email Service with PDF Support
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const jsPDF = require('jspdf');

// Email service configuration
const EMAIL_CONFIG = {
  // Set to 'mock' for development, 'sendgrid' for production
  mode: process.env.EMAIL_MODE || 'mock',
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY
  },
  from: {
    email: process.env.EMAIL_FROM || 'noreply@ticketunify.com',
    name: 'TicketUnify'
  }
};

// Initialize SendGrid email transport
let emailTransport = null;

if (EMAIL_CONFIG.mode === 'sendgrid' && EMAIL_CONFIG.sendgrid.apiKey) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(EMAIL_CONFIG.sendgrid.apiKey);
    emailTransport = sgMail;
    console.log('📧 Email service: SendGrid initialized successfully');
    console.log('📧 Sender email:', EMAIL_CONFIG.from.email);
  } catch (error) {
    console.error('❌ SendGrid initialization failed:', error.message);
    console.log('📧 Email service: Falling back to mock mode');
  }
} else {
  console.log('📧 Email service: Mock mode (development)');
  if (EMAIL_CONFIG.mode === 'sendgrid' && !EMAIL_CONFIG.sendgrid.apiKey) {
    console.warn('⚠️  SendGrid mode selected but no API key provided');
  }
}

// ===========================================
// PDF GENERATION FUNCTIONS
// ===========================================

// Generate QR Code as base64 - FIXED FOR VISIBILITY
async function generateQRCodeBase64(ticketId) {
  try {
    // Use your actual domain or localhost for development
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const validationUrl = `${baseUrl}/validate/${ticketId}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 300,        // ✅ INCREASED: Larger QR code for better visibility
      margin: 2,
      color: {
        dark: '#000000', // ✅ FIXED: Pure black for maximum contrast
        light: '#ffffff' // White background
      },
      errorCorrectionLevel: 'M'  // ✅ ADDED: Better error correction
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

// Generate PDF ticket as base64
async function generateTicketPDF(ticketData) {
  try {
    console.log('📄 Generating PDF for ticket:', ticketData.ticketId);
    
    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Generate QR code
    const qrCodeBase64 = await generateQRCodeBase64(ticketData.ticketId);

    // Set up the ticket design - Blue gradient background
    pdf.setFillColor(59, 130, 246); // Blue background
    pdf.rect(10, 10, 277, 190, 'F');

    // White content area
    pdf.setFillColor(255, 255, 255);
    pdf.rect(20, 20, 257, 170, 'F');

    // Add title
    pdf.setTextColor(59, 130, 246);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(ticketData.eventName || 'Event Name', 30, 40);

    // Add date
    const eventDate = new Date(ticketData.eventDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(12);
    pdf.text(`📅 ${eventDate}`, 30, 50);

    // Add attendee info
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(12);
    pdf.text('ATTENDEE', 30, 65);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(ticketData.fullName || 'Attendee Name', 30, 75);

    // Add event details
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`📍 ${ticketData.location || 'Event Location'}`, 30, 90);
    pdf.text(`🎫 ${ticketData.ticketType || 'Standard'} Ticket`, 30, 100);

    // Add ticket ID
    pdf.text('TICKET ID', 30, 120);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`#${ticketData.ticketId}`, 30, 130);

    // Add QR code if generated
    if (qrCodeBase64) {
      const qrSize = 50;
      pdf.addImage(qrCodeBase64, 'PNG', 200, 80, qrSize, qrSize);
    }

    // Add avatar if provided
    if (ticketData.avatarUrl && ticketData.avatarUrl.startsWith('data:image')) {
      try {
        pdf.addImage(ticketData.avatarUrl, 'JPEG', 220, 30, 30, 30);
      } catch (error) {
        console.warn('Could not add avatar to PDF:', error);
      }
    }

    // Convert to base64
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    console.log('✅ PDF generated successfully');
    return pdfBase64;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}

// ===========================================
// EMAIL TEMPLATE FUNCTIONS
// ===========================================

function generateTicketEmailHTML(ticketData, qrCodeBase64) {
  const eventDate = new Date(ticketData.eventDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Ticket is Ready!</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 32px; font-weight: bold; }
        .header p { color: #dbeafe; margin: 10px 0 0 0; font-size: 16px; }
        .content { padding: 40px 20px; }
        .ticket-preview { background: linear-gradient(135deg, #3b82f6, #7c3aed); border-radius: 16px; padding: 30px; margin: 30px 0; color: white; position: relative; }
        .ticket-header { margin-bottom: 20px; }
        .ticket-title { font-size: 24px; font-weight: bold; margin: 0; }
        .ticket-date { color: #dbeafe; margin: 5px 0 0 0; }
        .attendee-section { margin: 20px 0; }
        .attendee-label { color: #dbeafe; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .attendee-name { font-size: 20px; font-weight: bold; margin: 0; }
        .event-details { margin: 15px 0; line-height: 1.6; }
        .ticket-footer { margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); }
        .ticket-id { font-family: monospace; }
        .cta-section { text-align: center; margin: 40px 0; }
        .btn { display: inline-block; padding: 16px 32px; background-color: #3b82f6; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 0 10px 10px 0; }
        .btn-secondary { background-color: #6b7280; color: white !important; }
        .info-section { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .info-title { color: #374151; font-weight: bold; margin-bottom: 10px; }
        .info-list { color: #6b7280; line-height: 1.6; }
        .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; color: #6b7280; font-size: 14px; }
        @media (max-width: 600px) {
          .btn { display: block; width: 100%; margin: 10px 0; text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>🎫 TicketUnify</h1>
          <p>Your ticket is ready!</p>
        </div>

        <!-- Content -->
        <div class="content">
          <h2>Hi ${ticketData.fullName}!</h2>
          <p>Great news! Your ticket for <strong>${ticketData.eventName}</strong> has been generated and is attached to this email.</p>

          <!-- Ticket Preview -->
          <div class="ticket-preview">
            <div class="ticket-header">
              <h3 class="ticket-title">${ticketData.eventName}</h3>
              <p class="ticket-date">📅 ${eventDate}</p>
            </div>

            <div class="attendee-section">
              <div class="attendee-label">ATTENDEE</div>
              <div class="attendee-name">${ticketData.fullName}</div>
            </div>

            <div class="event-details">
              <div>📍 ${ticketData.location}</div>
              <div>🎫 ${ticketData.ticketType} Ticket</div>
            </div>

            <div class="ticket-footer">
              <div class="attendee-label">TICKET ID</div>
              <div class="ticket-id">#${ticketData.ticketId}</div>
            </div>
          </div>

          <!-- CTA Buttons -->
          <div class="cta-section">
            <a href="${baseUrl}/validate/${ticketData.ticketId}" class="btn">
              View QR Code & Check-in
            </a>
            <a href="${baseUrl}/dashboard" class="btn btn-secondary">
              View Dashboard
            </a>
          </div>


          <p>We're excited to see you at the event!</p>
          <p>Best regards,<br>The TicketUnify Team</p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>© 2025 TicketUnify. All rights reserved.</p>
          <p>This email was sent because you created a ticket on our platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ===========================================
// EMAIL SENDING FUNCTIONS
// ===========================================

// Send ticket email with PDF attachment using SendGrid
const sendTicketEmail = async (ticketData, recipients = null) => {
  try {
    console.log('📧 Sending ticket email for:', ticketData.ticketId);

    // Determine recipients
    const emailRecipients = recipients || [ticketData.email];
    const uniqueRecipients = [...new Set(emailRecipients)];

    // Generate PDF attachment
    let pdfBase64 = null;
    try {
      pdfBase64 = await generateTicketPDF(ticketData);
    } catch (error) {
      console.error('❌ Failed to generate PDF:', error);
    }

    // Generate QR code for email content
    const qrCodeBase64 = await generateQRCodeBase64(ticketData.ticketId);

    // Generate email HTML
    const emailHTML = generateTicketEmailHTML(ticketData, qrCodeBase64);

    // Prepare email data for SendGrid
    const emailData = {
      to: uniqueRecipients,
      from: {
        email: EMAIL_CONFIG.from.email,
        name: EMAIL_CONFIG.from.name
      },
      subject: `🎫 Your ticket for ${ticketData.eventName} is ready!`,
      html: emailHTML,
      text: `Your ticket for ${ticketData.eventName} is ready! Ticket ID: ${ticketData.ticketId}. Please check your email for the PDF attachment.`,
      attachments: []
    };

    // Add PDF attachment if generated
    if (pdfBase64) {
      emailData.attachments.push({
        content: pdfBase64,
        filename: `${ticketData.eventName.replace(/[^a-zA-Z0-9]/g, '_')}-ticket.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      });
    }

    // Send email based on configuration
    let result;

    if (EMAIL_CONFIG.mode === 'sendgrid' && emailTransport) {
      try {
        // Send to multiple recipients if needed
        if (uniqueRecipients.length === 1) {
          result = await emailTransport.send(emailData);
        } else {
          result = await emailTransport.sendMultiple(emailData);
        }
        
        console.log('✅ SendGrid email sent successfully');
        console.log('📬 Recipients:', uniqueRecipients.join(', '));
        console.log('📎 PDF attached:', !!pdfBase64);
        
        return {
          success: true,
          messageId: result?.[0]?.messageId || `sg_${Date.now()}`,
          recipients: uniqueRecipients,
          timestamp: new Date().toISOString(),
          pdfAttached: !!pdfBase64,
          service: 'SendGrid'
        };
        
      } catch (sendGridError) {
        console.error('❌ SendGrid error:', sendGridError);
        
        // Enhanced error handling for common SendGrid issues
        if (sendGridError.code === 401) {
          throw new Error('SendGrid authentication failed. Check your API key.');
        } else if (sendGridError.code === 403) {
          throw new Error('SendGrid sender identity not verified. Please verify your sender email.');
        } else if (sendGridError.response?.body?.errors) {
          const errorMessages = sendGridError.response.body.errors.map(err => err.message).join(', ');
          throw new Error(`SendGrid API error: ${errorMessages}`);
        } else {
          throw new Error(`SendGrid error: ${sendGridError.message}`);
        }
      }
    } else {
      // Mock mode - simulate sending
      result = await simulateEmailSending(ticketData, uniqueRecipients, emailHTML);
      return result;
    }

  } catch (error) {
    console.error('❌ Error sending ticket email:', error);
    throw new Error(`Failed to send ticket email: ${error.message}`);
  }
};

// Mock email sending for development
async function simulateEmailSending(ticketData, recipients, emailHTML) {
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n📧 ================ EMAIL SENT (MOCK) ================');
  console.log('📬 To:', recipients.join(', '));
  console.log('📋 Subject:', `🎫 Your ticket for ${ticketData.eventName} is ready!`);
  console.log('✅ Status: Successfully sent (MOCK)');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🎫 Ticket ID:', ticketData.ticketId);
  console.log('👤 Recipient:', ticketData.fullName);
  console.log('🎪 Event:', ticketData.eventName);
  console.log('📄 PDF Attached: Yes');
  console.log('==================================================\n');
  
  // Save email to file for debugging in development
  if (process.env.NODE_ENV === 'development') {
    try {
      const emailLog = {
        timestamp: new Date().toISOString(),
        to: recipients,
        subject: `🎫 Your ticket for ${ticketData.eventName} is ready!`,
        ticketId: ticketData.ticketId,
        eventName: ticketData.eventName,
        content: emailHTML
      };
      
      // Create logs directory if it doesn't exist
      const logsDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Save email log
      const logFile = path.join(logsDir, 'emails.log');
      fs.appendFileSync(logFile, JSON.stringify(emailLog, null, 2) + '\n\n');
    } catch (logError) {
      console.warn('Could not save email log:', logError.message);
    }
  }
  
  return {
    success: true,
    messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    recipients: recipients,
    timestamp: new Date().toISOString(),
    pdfAttached: true,
    service: 'Mock'
  };
}

// Send welcome email for new users
const sendWelcomeEmail = async (userData) => {
  try {
    if (EMAIL_CONFIG.mode === 'sendgrid' && emailTransport) {
      const welcomeEmail = {
        to: userData.email,
        from: {
          email: EMAIL_CONFIG.from.email,
          name: EMAIL_CONFIG.from.name
        },
        subject: 'Welcome to TicketUnify! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3b82f6;">Welcome to TicketUnify!</h1>
            <p>Hi ${userData.fullName},</p>
            <p>Thank you for joining TicketUnify! You can now create professional tickets with QR codes and email delivery.</p>
            <p>Get started by creating your first ticket!</p>
            <p>Best regards,<br>The TicketUnify Team</p>
          </div>
        `,
        text: `Welcome to TicketUnify! Hi ${userData.fullName}, thank you for joining TicketUnify!`
      };
      
      await emailTransport.send(welcomeEmail);
      console.log('✅ Welcome email sent via SendGrid');
    } else {
      console.log('\n📧 ============= WELCOME EMAIL SENT (MOCK) =============');
      console.log('📬 To:', userData.email);
      console.log('👤 Name:', userData.fullName);
      console.log('✅ Status: Successfully sent (MOCK)');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('==============================================\n');
    }
    
    return {
      success: true,
      messageId: `welcome_${Date.now()}`,
      recipient: userData.email,
      service: EMAIL_CONFIG.mode === 'sendgrid' ? 'SendGrid' : 'Mock'
    };
  } catch (error) {
    console.error('❌ Welcome Email Error:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    if (EMAIL_CONFIG.mode === 'sendgrid' && emailTransport) {
      const resetEmail = {
        to: email,
        from: {
          email: EMAIL_CONFIG.from.email,
          name: EMAIL_CONFIG.from.name
        },
        subject: 'Reset Your TicketUnify Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3b82f6;">Password Reset Request</h1>
            <p>You requested a password reset for your TicketUnify account.</p>
            <p>Use this token to reset your password: <strong>${resetToken}</strong></p>
            <p>This token will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The TicketUnify Team</p>
          </div>
        `,
        text: `Password reset token: ${resetToken}. This token expires in 1 hour.`
      };
      
      await emailTransport.send(resetEmail);
      console.log('✅ Password reset email sent via SendGrid');
    } else {
      console.log('\n📧 ========== PASSWORD RESET EMAIL SENT (MOCK) ==========');
      console.log('📬 To:', email);
      console.log('🔑 Reset Token:', resetToken);
      console.log('✅ Status: Successfully sent (MOCK)');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('================================================\n');
    }
    
    return {
      success: true,
      messageId: `reset_${Date.now()}`,
      recipient: email,
      service: EMAIL_CONFIG.mode === 'sendgrid' ? 'SendGrid' : 'Mock'
    };
  } catch (error) {
    console.error('❌ Password Reset Email Error:', error);
    throw error;
  }
};

// Check email service health
const checkEmailService = async () => {
  let status = 'healthy';
  let details = {};

  try {
    if (EMAIL_CONFIG.mode === 'sendgrid') {
      status = emailTransport ? 'healthy' : 'unhealthy';
      details.service = 'SendGrid';
      details.configured = !!EMAIL_CONFIG.sendgrid.apiKey;
      details.apiKeyPresent = !!EMAIL_CONFIG.sendgrid.apiKey;
      details.fromEmail = EMAIL_CONFIG.from.email;
      
      if (!EMAIL_CONFIG.sendgrid.apiKey) {
        details.error = 'SendGrid API key not configured';
        status = 'unhealthy';
      }
    } else {
      details.service = 'Mock Email Service';
      details.configured = true;
      status = 'healthy';
    }
  } catch (error) {
    status = 'unhealthy';
    details.error = error.message;
  }

  return {
    status,
    mode: EMAIL_CONFIG.mode,
    timestamp: new Date().toISOString(),
    ...details
  };
};

module.exports = {
  sendTicketEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  checkEmailService,
  generateTicketPDF,
  generateQRCodeBase64
};