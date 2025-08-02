// utils/firebase-admin.js
const admin = require('firebase-admin');
const logger = require('./logger');

// Initialize Firebase Admin SDK - SAFE for GitHub (uses environment variables)
const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      // Using the same Firebase project as your frontend (ticketunify)
      // But with Admin SDK privileges for server-side operations
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID, // "ticketunify"
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
        token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };

      // Validate required environment variables
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Missing required Firebase Admin SDK environment variables. Please check your .env file.');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`, // ticketunify.appspot.com
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
      });

      logger.info('🔥 Firebase Admin SDK initialized successfully for project: ' + process.env.FIREBASE_PROJECT_ID);
    }
    return admin;
  } catch (error) {
    logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
};

// Get Firestore instance
const getFirestore = () => {
  const app = initializeFirebase();
  return app.firestore();
};

// Get Storage instance
const getStorage = () => {
  const app = initializeFirebase();
  return app.storage();
};

// Get Auth instance
const getAuth = () => {
  const app = initializeFirebase();
  return app.auth();
};

// Verify Firebase ID token
const verifyIdToken = async (idToken) => {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('Error verifying ID token:', error);
    throw new Error('Invalid or expired token');
  }
};

// Get user by UID
const getUserByUid = async (uid) => {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    logger.error('Error getting user by UID:', error);
    throw new Error('User not found');
  }
};

// Create custom token
const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    logger.error('Error creating custom token:', error);
    throw error;
  }
};

// Set custom user claims (for admin roles)
const setCustomUserClaims = async (uid, customClaims) => {
  try {
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, customClaims);
    logger.info(`Custom claims set for user ${uid}:`, customClaims);
  } catch (error) {
    logger.error('Error setting custom user claims:', error);
    throw error;
  }
};

// Upload file to Firebase Storage
const uploadToStorage = async (buffer, fileName, contentType) => {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      },
      public: true
    });

    // Get public URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491' // Far future date
    });

    return url;
  } catch (error) {
    logger.error('Error uploading to storage:', error);
    throw error;
  }
};

// Delete file from Firebase Storage
const deleteFromStorage = async (fileName) => {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    await file.delete();
    logger.info(`File deleted from storage: ${fileName}`);
  } catch (error) {
    logger.error('Error deleting from storage:', error);
    throw error;
  }
};

// Firestore helper functions
const firestoreHelpers = {
  // Add document
  addDocument: async (collection, data) => {
    try {
      const db = getFirestore();
      const docRef = await db.collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      logger.error(`Error adding document to ${collection}:`, error);
      throw error;
    }
  },

  // Get document by ID
  getDocument: async (collection, docId) => {
    try {
      const db = getFirestore();
      const doc = await db.collection(collection).doc(docId).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error(`Error getting document from ${collection}:`, error);
      throw error;
    }
  },

  // Update document
  updateDocument: async (collection, docId, data) => {
    try {
      const db = getFirestore();
      await db.collection(collection).doc(docId).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error(`Error updating document in ${collection}:`, error);
      throw error;
    }
  },

  // Delete document
  deleteDocument: async (collection, docId) => {
    try {
      const db = getFirestore();
      await db.collection(collection).doc(docId).delete();
    } catch (error) {
      logger.error(`Error deleting document from ${collection}:`, error);
      throw error;
    }
  },

  // Query documents
  queryDocuments: async (collection, queries = [], orderBy = null, limit = null) => {
    try {
      const db = getFirestore();
      let query = db.collection(collection);

      // Apply where clauses
      queries.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });

      // Apply ordering
      if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error(`Error querying documents from ${collection}:`, error);
      throw error;
    }
  }
};

module.exports = {
  admin,
  initializeFirebase,
  getFirestore,
  getStorage,
  getAuth,
  verifyIdToken,
  getUserByUid,
  createCustomToken,
  setCustomUserClaims,
  uploadToStorage,
  deleteFromStorage,
  firestoreHelpers
};