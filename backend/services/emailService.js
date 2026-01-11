const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send Welcome Email (for new users only)
const sendWelcomeEmail = async (userEmail, userName) => {
  try {
    console.log('📧 Sending welcome email to:', userEmail);

    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: 'Welcome to TicketUnify! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to TicketUnify!</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">Hi ${userName},</p>
            
            <p style="font-size: 16px; color: #374151;">
              Welcome to TicketUnify! Your account has been successfully created.
            </p>
            
            <p style="font-size: 16px; color: #374151;">
              Your ticket is being prepared and will arrive in your inbox shortly.
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-top: 30px;">
              Thanks for choosing TicketUnify!
            </p>
            
            <p style="font-size: 16px; color: #374151;">
              Best regards,<br/>
              <strong>The TicketUnify Team</strong>
            </p>
          </div>
          
          <div style="background-color: #1f2937; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2026 TicketUnify. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully to:', userEmail);
    return true;

  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw error;
  }
};

// Send Ticket Email with PDF attachment
const sendTicketEmail = async (recipientEmail, ticketData, pdfBuffer) => {
  try {
    console.log('📧 Sending ticket email to:', recipientEmail);

    const transporter = createTransporter();

    const validationLink = `${process.env.APP_URL}/validate/${ticketData.ticketId}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject: `Your ${ticketData.eventName} Ticket is Ready! 🎟️`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Your Ticket is Ready!</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">Hi ${ticketData.fullName},</p>
            
            <p style="font-size: 16px; color: #374151;">
              Your ticket for <strong>${ticketData.eventName}</strong> is ready!
            </p>
            
            <div style="background-color: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Event Details</h3>
              <p style="margin: 8px 0; color: #374151;"><strong>📅 Date:</strong> ${ticketData.eventDate}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>🕐 Time:</strong> ${ticketData.eventTime}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>📍 Location:</strong> ${ticketData.location}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>🎫 Ticket ID:</strong> ${ticketData.ticketId}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>💳 Type:</strong> ${ticketData.ticketType}</p>
            </div>
            
            <p style="font-size: 16px; color: #374151;">
              Your ticket PDF is attached to this email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${validationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Quick Access - Validate Ticket
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
              Or copy this link: <br/>
              <span style="font-size: 12px; word-break: break-all;">${validationLink}</span>
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> Please save this email or download the PDF for entry to your event.
              </p>
            </div>
            
            <p style="font-size: 16px; color: #374151; margin-top: 30px;">
              See you there!
            </p>
            
            <p style="font-size: 16px; color: #374151;">
              Best regards,<br/>
              <strong>The TicketUnify Team</strong>
            </p>
          </div>
          
          <div style="background-color: #1f2937; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2026 TicketUnify. All rights reserved.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `ticket-${ticketData.ticketId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Ticket email sent successfully to:', recipientEmail);
    return true;

  } catch (error) {
    console.error('❌ Error sending ticket email:', error);
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendTicketEmail
};