// controllers/ticketController.js

const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const admin = require('firebase-admin');
const { sendTicketEmail } = require('../services/emailService');
const { generateTicketPDF } = require('../services/pdfService');

const db = admin.firestore();

// Create a new ticket
const createTicket = async (req, res) => {
  try {
    const { fullName, email, eventName, eventDate, ticketType, location } = req.body;
    
    // Validate required fields
    if (!fullName || !email || !eventName || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fullName, email, eventName, eventDate'
      });
    }

    // Generate unique ticket ID
    const ticketId = uuidv4().substring(0, 8).toUpperCase();
    
    // Generate QR code
    const qrCodeData = JSON.stringify({
      ticketId,
      eventName,
      fullName,
      timestamp: Date.now()
    });
    const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

    // Prepare ticket data
    const ticketData = {
      ticketId,
      fullName,
      email,
      eventName,
      eventDate,
      ticketType: ticketType || 'Standard',
      location: location || '',
      qrCode: qrCodeUrl,
      status: 'active',
      checkedIn: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: req.user?.uid || 'anonymous'
    };

    // Save to Firestore
    const docRef = await db.collection('tickets').add(ticketData);
    
    // Send confirmation email
    try {
      await sendTicketEmail({
        ...ticketData,
        id: docRef.id
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the ticket creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticketId: docRef.id,
      ticket: {
        id: docRef.id,
        ...ticketData
      }
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

// Get ticket by ID
const getTicket = async (req, res) => {
  try {
    const { id } = req.params;
    
    const doc = await db.collection('tickets').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      ticket: {
        id: doc.id,
        ...doc.data()
      }
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket',
      error: error.message
    });
  }
};

// Check in a ticket
const checkInTicket = async (req, res) => {
  try {
    const { id } = req.params;
    
    const doc = await db.collection('tickets').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticketData = doc.data();
    
    if (ticketData.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Ticket already checked in'
      });
    }

    // Update ticket
    await db.collection('tickets').doc(id).update({
      checkedIn: true,
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Ticket checked in successfully',
      ticket: {
        id,
        ...ticketData,
        checkedIn: true
      }
    });

  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in ticket',
      error: error.message
    });
  }
};

// Get tickets for a user
const getUserTickets = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const snapshot = await db.collection('tickets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets',
      error: error.message
    });
  }
};

// Delete a ticket
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    
    const doc = await db.collection('tickets').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user owns the ticket (if not admin)
    const ticketData = doc.data();
    if (req.user && !req.user.admin && ticketData.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    await db.collection('tickets').doc(id).delete();

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ticket',
      error: error.message
    });
  }
};

module.exports = {
  createTicket,
  getTicket,
  checkInTicket,
  getUserTickets,
  deleteTicket
};