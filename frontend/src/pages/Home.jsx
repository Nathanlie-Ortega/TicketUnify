// src/pages/Home.jsx - Updated with Backend Email Integration and Fixed Post-Signup Email
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import TicketForm from '../components/TicketForm';
import TicketPreview from '../components/TicketPreview';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';

// Helper function to generate ticket ID
const generateTicketId = () => {
  return 'TICKET-' + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const [ticketData, setTicketData] = useState({
    fullName: '',
    email: '',
    eventName: '',
    eventDate: getTodayDate(),
    location: 'Dallas, TX',
    ticketType: 'Standard'
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emailStatus, setEmailStatus] = useState('');
  const { currentUser } = useAuth();
  const { addTicket } = useTickets(); // Use the ticket context
  const navigate = useNavigate();

  // Helper function to convert file to base64 URL
  const convertFileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Save avatar to storage for navbar use (only for the first ticket when signing up)
  const saveAvatarToStorage = async (avatarFile, ticketData, isFirstTicket = false) => {
    try {
      if (avatarFile) {
        const avatarDataURL = await convertFileToDataURL(avatarFile);
        if (avatarDataURL) {
          // Always save for current ticket preview
          sessionStorage.setItem('currentTicketAvatar', avatarDataURL);
          
          // Save ticket data with avatar for later reference
          const ticketDataWithAvatar = {
            ...ticketData,
            avatarUrl: avatarDataURL,
            timestamp: Date.now()
          };
          localStorage.setItem('recentTicketData', JSON.stringify(ticketDataWithAvatar));
          
          // Save ticket-specific avatar using ticket ID if available
          if (ticketData.id) {
            localStorage.setItem(`ticket-avatar-${ticketData.id}`, avatarDataURL);
          }
          
          // Only save as account profile picture if this is the first ticket and user isn't logged in
          if (!currentUser && isFirstTicket) {
            // This will become the account profile picture when user signs up
            localStorage.setItem('pendingUserProfileImage', avatarDataURL);
            console.log('💾 Saved as pending account profile picture');
          }
          
          console.log('💾 Avatar saved to storage for ticket use');
        }
      }
    } catch (error) {
      console.warn('Failed to save avatar to storage:', error);
    }
  };

  // Function to call backend email service
  const sendTicketEmail = async (ticketData, userEmail = null) => {
    try {
      console.log('📧 Calling backend email service...');
      
      // Prepare recipients (both account email and ticket email if different)
      const recipients = [];
      if (userEmail) recipients.push(userEmail);
      if (ticketData.email && ticketData.email !== userEmail) {
        recipients.push(ticketData.email);
      }
      
      const response = await fetch('http://localhost:5000/api/email/send-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketData: {
            ticketId: ticketData.ticketId,
            fullName: ticketData.fullName,
            email: ticketData.email,
            eventName: ticketData.eventName,
            eventDate: ticketData.eventDate,
            location: ticketData.location,
            ticketType: ticketData.ticketType,
            avatarUrl: ticketData.avatarUrl
          },
          recipients: recipients.length > 0 ? recipients : [ticketData.email]
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Email sent successfully:', result);
        return result;
      } else {
        console.error('❌ Email sending failed:', result);
        throw new Error(result.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('❌ Error calling email service:', error);
      throw error;
    }
  };

  // Handle real-time preview updates (no backend call)
  const handlePreviewUpdate = async (data, file) => {
    console.log('Preview update:', data);
    setTicketData(data);
    setAvatarFile(file);
    
    // Check if this is the user's first ticket (when not logged in)
    const isFirstTicket = !currentUser;
    
    // Save avatar to storage for ticket and potentially account use
    await saveAvatarToStorage(file, data, isFirstTicket);
    
    // Clear any previous errors when user makes changes
    setError(null);
    setEmailStatus('');
  };

  // Handle actual form submission - UPDATED WITH EMAIL INTEGRATION
  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    setError(null);
    setEmailStatus('');
    
    try {
      console.log('Creating ticket with data:', formData);
      
      // Validate Firebase connection first
      if (!db) {
        throw new Error('Firebase database not initialized. Check your Firebase configuration.');
      }
      
      // Generate ticket ID
      const ticketId = generateTicketId();
      
      // Prepare ticket data for Firestore - ENSURE USER LINKING
      const ticketDataForFirestore = {
        ticketId: ticketId,
        fullName: formData.fullName || '',
        email: formData.email || '',
        eventName: formData.eventName || '',
        eventDate: formData.eventDate || getTodayDate(),
        location: formData.location || 'Dallas, TX',
        ticketType: formData.ticketType || 'Standard',
        // CRITICAL: Proper user linking
        userId: currentUser?.uid || null,
        userEmail: currentUser?.email || formData.email || '',
        // For anonymous users, still store the email for future linking
        status: 'active',
        checkedIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Email status tracking
        emailSent: false,
        emailError: null
      };
      
      // Add avatar URL to ticket data if available
      if (avatarFile) {
        const avatarDataURL = await convertFileToDataURL(avatarFile);
        if (avatarDataURL) {
          ticketDataForFirestore.avatarUrl = avatarDataURL;
        }
      }
      
      console.log('Attempting to save ticket to Firestore:', ticketDataForFirestore);
      
      // Test Firestore connection with a timeout
      const savePromise = addDoc(collection(db, 'tickets'), ticketDataForFirestore);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000)
      );
      
      const docRef = await Promise.race([savePromise, timeoutPromise]);
            
      // Create final ticket data with Firestore document ID
      const finalTicketData = {
        id: docRef.id,
        ...ticketDataForFirestore
      };
      
      // Save ticket-specific avatar to storage
      if (avatarFile) {
        const avatarDataURL = await convertFileToDataURL(avatarFile);
        if (avatarDataURL) {
          // Save ticket-specific avatar
          localStorage.setItem(`ticket-avatar-${docRef.id}`, avatarDataURL);
          console.log('Saved ticket-specific avatar for:', docRef.id);
        }
      }
      
      // Update local state
      setTicketData(finalTicketData);
      setCreatedTicket(finalTicketData);
      setPreviewMode(true);
      
      // CRITICAL: Add to ticket context for immediate dashboard update
      if (addTicket) {
        addTicket(finalTicketData);
      }

      // Save ticket data for post-signup email delivery
      const ticketDataForEmail = {
        ticketId: finalTicketData.ticketId,
        fullName: finalTicketData.fullName,
        email: finalTicketData.email,
        eventName: finalTicketData.eventName,
        eventDate: finalTicketData.eventDate,
        location: finalTicketData.location,
        ticketType: finalTicketData.ticketType,
        avatarUrl: finalTicketData.avatarUrl,
        firestoreId: docRef.id, // Add Firestore document ID for later updates
        timestamp: Date.now(),
        needsEmail: true // ✅ CRITICAL: This flag tells Register.jsx to send email
      };
      localStorage.setItem('recentTicketData', JSON.stringify(ticketDataForEmail));
      console.log('💾 Saved ticket data for potential post-signup email with needsEmail=true');

      // 🆕 NEW: Send email if user is signed up
      if (currentUser) {
        try {

          
          await sendTicketEmail(finalTicketData, currentUser.email);
          
          // Update ticket with email sent status
          const emailRecipients = [currentUser.email];
          if (finalTicketData.email && finalTicketData.email !== currentUser.email) {
            emailRecipients.push(finalTicketData.email);
          }
          
          await updateDoc(doc(db, 'tickets', docRef.id), {
            emailSent: true,
            emailSentAt: new Date().toISOString(),
            emailRecipients: emailRecipients
          });
          
          // Update local ticket data
          finalTicketData.emailSent = true;
          finalTicketData.emailSentAt = new Date().toISOString();
          finalTicketData.emailRecipients = emailRecipients;
          

        } catch (emailError) {

          
          // Update ticket with email error
          await updateDoc(doc(db, 'tickets', docRef.id), {
            emailError: emailError.message,
            emailErrorAt: new Date().toISOString()
          });
          
          // Update local ticket data
          finalTicketData.emailError = emailError.message;
          finalTicketData.emailErrorAt = new Date().toISOString();
          
          setEmailStatus('⚠️ Ticket created but email failed to send. You can resend from dashboard.');
        }
      } else {
        console.log('👤 User not signed up, saving ticket for post-signup email...');
        setEmailStatus('Sign up to receive your ticket via email!');
      }

    } catch (error) {
      // Error handling remains the same...
      let errorMessage = 'Failed to create ticket. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Service temporarily unavailable. Please try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please check your internet connection.';
      } else if (error.message.includes('Firebase')) {
        errorMessage += 'Database connection issue. Please refresh the page and try again.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setError(errorMessage);
      
      // For development, show detailed error in console
      console.error('Full error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    setPreviewMode(false);
    setCreatedTicket(null);
    setError(null);
    setEmailStatus('');
  };

  // Navigate to register page and handle profile picture for account creation only
  const handleSignUp = async () => {
    try {
      // Only save account profile data if this is the first ticket creation
      if (avatarFile && ticketData.fullName) {
        const avatarDataURL = await convertFileToDataURL(avatarFile);
        if (avatarDataURL) {
          // Save for account creation (not for individual tickets)
          localStorage.setItem('pendingUserProfileImage', avatarDataURL);
          localStorage.setItem('pendingUserName', ticketData.fullName);
          
          // Dispatch custom event to notify navbar about ACCOUNT profile update
          window.dispatchEvent(new CustomEvent('userProfileUpdated', {
            detail: {
              name: ticketData.fullName,
              email: ticketData.email,
              avatar: avatarDataURL
            }
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save profile data for signup:', error);
    }
    
    navigate('/register');
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      {/* Hero Section */}
      <div className="text-center py-12 mb-8">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
          TicketUnify
          <span className="text-blue-600 dark:text-blue-400"> Studio</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
          Create professional tickets with QR codes, email delivery, and validation. 
          Perfect for events, workshops, and conferences.
        </p>
        
        {!currentUser && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 border-2 border-blue-600 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Form Section */}
          <div className="order-2 lg:order-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-600 dark:border-gray-700 p-6 transition-colors">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {previewMode ? 'Ticket Generated!' : 'Create Your Ticket'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {previewMode 
                  ? 'Your ticket has been generated and saved. You can download it or make changes.' 
                  : 'Fill in your details to generate a professional conference ticket.'
                }
              </p>
              
              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-red-800 dark:text-red-400 font-medium">Error Creating Ticket</p>
                        <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                      </div>
                    </div>
                    <button
                      onClick={clearError}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {!previewMode ? (
                <TicketForm 
                  onPreviewUpdate={handlePreviewUpdate}
                  onSubmitSuccess={handleFormSubmit}
                  initialData={ticketData}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-green-800 dark:text-green-400 font-medium">
                      {currentUser 
                        ? "✅ Ticket created and saved successfully!"
                        : "✅ Temporary ticket created and saved successfully!"
                      }
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                      {createdTicket && (
                        <>
                          <strong>Ticket ID:</strong> {createdTicket.ticketId}
                          <br />
                          <strong>Status:</strong> {createdTicket.status}
                          <br />
                          {currentUser 
                            ? 'Your ticket has been saved to your account and will appear in your dashboard!' 
                            : 'Sign up to save tickets permanently, secure validation, and enable email delivery.'
                          }
                        </>
                      )}
                    </p>
                  </div>

                  {/* Email Status Display */}
                  {emailStatus && (
                    <div className={`p-4 rounded-lg border ${
                      emailStatus.includes('✅') 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                        : emailStatus.includes('⚠️')
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                    }`}>
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Email Status</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{emailStatus}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    {!currentUser ? (
                      <button
                        onClick={handleSignUp}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Sign Up to Save & Get Email
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        View Dashboard
                      </button>
                    )}
                    
                  </div>
                </div>
              )}
            </div>

            {/* Features */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-blue-600 dark:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">QR Code</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Secure validation</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-blue-600 dark:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Email Delivery</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentUser ? 'PDF tickets via email' : 'Sign up to enable'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="order-1 lg:order-2">
            <div className="sticky top-8">
              <TicketPreview 
                ticketData={ticketData}
                avatarFile={avatarFile}
                showDownload={previewMode}
                isGenerated={previewMode && createdTicket !== null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}