// server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin (only if credentials are available)
try {
  const admin = require('firebase-admin');
  
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token"
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('🔥 Firebase initialized successfully');
    }
  } else {
    console.log('⚠️  Firebase credentials not found - running in development mode');
  }
} catch (error) {
  console.log('⚠️  Firebase initialization skipped:', error.message);
}

// Import routes (with error handling)
try {
  const ticketRoutes = require('./routes/tickets');
  app.use('/api/tickets', ticketRoutes);
  console.log('✅ Ticket routes loaded');
} catch (error) {
  console.log('⚠️  Ticket routes not loaded:', error.message);
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'TicketUnify Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'TicketUnify API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      tickets: '/api/tickets'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n🚀 =======================================');
  console.log(`📊 TicketUnify Backend Server Started`);
  console.log(`🌍 Port: ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🎫 API Base: http://localhost:${PORT}/api`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('=========================================\n');
});

module.exports = app;