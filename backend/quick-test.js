// backend/quick-test.js - Create this file and run it
require('dotenv').config();

console.log('🔍 Quick SendGrid Test');
console.log('======================');
console.log('EMAIL_MODE:', process.env.EMAIL_MODE);
console.log('API Key present:', !!process.env.SENDGRID_API_KEY);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'nathanlieortega.dev@gmail.com', // Corrected email address
  from: 'nathanlieortega.dev@gmail.com', // Corrected email address
  subject: 'SendGrid Test - TicketUnify',
  text: 'If you receive this, SendGrid is working!',
  html: '<p>If you receive this, <strong>SendGrid is working!</strong></p>',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Email sent successfully!');
    console.log('📬 Check your Gmail inbox (and spam folder)');
  })
  .catch((error) => {
    console.error('❌ Error:', error.response?.body || error.message);
  });