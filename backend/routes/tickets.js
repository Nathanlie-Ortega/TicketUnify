const express = require('express');
const router = express.Router();

// Simple auth middleware - for now just pass through
const auth = (req, res, next) => {
  req.user = { uid: 'anonymous', admin: false };
  next();
};

// Import controller functions
let ticketController;
try {
  ticketController = require('../controllers/ticketController');
} catch (error) {
  console.log('⚠️ Ticket controller not found, using simple handlers');
}

// Simple ticket creation handler (fallback)
const createTicketSimple = async (req, res) => {
  try {
    const { fullName, email, eventName, eventDate, ticketType, location } = req.body;
    
    // Validate required fields
    if (!fullName || !email || !eventName || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fullName, email, eventName, eventDate'
      });
    }

    // Generate simple ticket ID
    const ticketId = 'TICKET-' + Date.now().toString().slice(-6);
    
    // Create ticket response with QR code
    const qrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
    
    const ticket = {
      id: ticketId,
      ticketId: ticketId, // Make sure both id and ticketId are set
      fullName,
      email,
      eventName,
      eventDate,
      ticketType: ticketType || 'Standard',
      location: location || '',
      status: 'active',
      checkedIn: false,
      createdAt: new Date().toISOString(),
      qrCode: qrCode
    };

    console.log('\n🎫 ================ TICKET CREATED ================');
    console.log('🆔 Ticket ID:', ticketId);
    console.log('👤 Name:', fullName);
    console.log('📧 Email:', email);
    console.log('🎪 Event:', eventName);
    console.log('📅 Date:', eventDate);
    console.log('🎟️ Type:', ticketType);
    console.log('📍 Location:', location);
    console.log('=================================================\n');

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticketId: ticketId,
      ticket: ticket
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
};

// Routes - use controller if available, otherwise use simple handlers
if (ticketController) {
  router.post('/', auth, ticketController.createTicket);
  router.get('/:id', auth, ticketController.getTicket);
  router.patch('/:id/checkin', auth, ticketController.checkInTicket);
  router.get('/user/:userId', auth, ticketController.getUserTickets);
  router.delete('/:id', auth, ticketController.deleteTicket);
} else {
  // Fallback simple routes
  router.post('/', auth, createTicketSimple);
  router.get('/:id', auth, (req, res) => {
    res.json({ success: true, message: 'Get ticket endpoint working', id: req.params.id });
  });
  router.patch('/:id/checkin', auth, (req, res) => {
    res.json({ success: true, message: 'Check-in endpoint working', id: req.params.id });
  });
}

// Test route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Tickets API is working',
    endpoints: {
      'POST /': 'Create ticket',
      'GET /:id': 'Get ticket by ID',
      'PATCH /:id/checkin': 'Check in ticket'
    }
  });
});

// CREATE PAYMENT INTENT - MOVED HERE!
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { ticketType, ticketData } = req.body;
    
    const stripeService = require('../services/stripeService');
    const priceInfo = stripeService.TICKET_PRICES[ticketType];
    
    if (!priceInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type'
      });
    }

    if (priceInfo.amount === 0) {
      return res.json({
        success: true,
        message: 'Free ticket, no payment needed',
        requiresPayment: false
      });
    }

    const paymentIntent = await stripeService.createPaymentIntent({ 
      ticketData: {
        ...ticketData,
        ticketType: ticketType  // ← ADD ticketType here!
      }
    });

    res.json({
      success: true,
      requiresPayment: true,
      clientSecret: paymentIntent.clientSecret,
      amount: priceInfo.amount / 100,
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

module.exports = router;