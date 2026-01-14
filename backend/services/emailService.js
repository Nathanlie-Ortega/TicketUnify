const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Send Welcome Email
const sendWelcomeEmail = async (userEmail, userName) => {
  try {
    console.log(' Sending welcome email to:', userEmail);

    const msg = {
      to: userEmail,
      from: process.env.EMAIL_FROM || 'nathanilieortega.dev@gmail.com',
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

    await sgMail.send(msg);
    console.log(' Welcome email sent successfully');
    return true;

  } catch (error) {
    console.error(' Error sending welcome email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
};

// Send Ticket Email with PDF
const sendTicketEmail = async (recipientEmail, ticketData, pdfBuffer) => {
  try {
    console.log(' Sending ticket email to:', recipientEmail);

    const validationLink = `${process.env.APP_URL || 'https://ticket-unify.vercel.app'}/validate/${ticketData.ticketId}`;

    const msg = {
      to: recipientEmail,
      from: process.env.EMAIL_FROM || 'nathanilieortega.dev@gmail.com',
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
              <p style="margin: 8px 0; color: #374151;"><strong>🕐 Time:</strong> ${ticketData.eventTime || 'TBD'}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>📍 Location:</strong> ${ticketData.location}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>🎫 Ticket ID:</strong> ${ticketData.ticketId}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>💳 Type:</strong> ${ticketData.ticketType}</p>
            </div>
            
            ${pdfBuffer ? '<p style="font-size: 16px; color: #374151;">Your ticket PDF is attached to this email.</p>' : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${validationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Validate Ticket
              </a>
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
      `
    };

    // Add PDF attachment if provided
    if (pdfBuffer) {
      msg.attachments = [
        {
          content: pdfBuffer.toString('base64'),
          filename: `ticket-${ticketData.ticketId}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ];
    }

    await sgMail.send(msg);
    console.log(' Ticket email sent successfully');
    return true;

  } catch (error) {
    console.error(' Error sending ticket email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendTicketEmail
};