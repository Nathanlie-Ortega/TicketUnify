// src/pages/Home.jsx - UPDATED: Require signup before ticket creation
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';import { db } from '../utils/firebase';
import TicketForm from '../components/TicketForm';
import TicketPreview from '../components/TicketPreview';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { generateTicketPDFBuffer } from '../utils/pdfHelper';
import html2canvas from 'html2canvas';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';
import Modal from '../components/ui/Modal';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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
    eventTime: (() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    })(),
    location: 'Dallas, TX',
    ticketType: 'Standard'
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emailStatus, setEmailStatus] = useState('');
  const [isProcessingTicket, setIsProcessingTicket] = useState(false);

  
  const { currentUser } = useAuth();
  const { addTicket } = useTickets();
  const navigate = useNavigate();
  const location = useLocation();
  

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [pendingTicketData, setPendingTicketData] = useState(null);

  // Handle real-time preview updates
  const handlePreviewUpdate = (formData, avatar) => {
    setTicketData(formData);
    setAvatarFile(avatar);
  };




  // Handle post-signup ticket creation - ONE TIME ONLY
  useEffect(() => {
    if (!currentUser) return;

    const pendingDataStr = sessionStorage.getItem('pendingTicketData');
    
    // Most important guard: if no pending data anymore → exit immediately
    if (!pendingDataStr) {
      console.log('No pending ticket data found → skipping');
      return;
    }

    // Extra safety: process only once per mount + user change
    // We use an IIFE so we can await inside
    (async () => {
      console.log('🔒 Attempting to process pending ticket...');

      // FINAL LOCK - remove pending data BEFORE anything else
      // This prevents any parallel run from seeing it
      sessionStorage.removeItem('pendingTicketData');

      try {
        const pendingData = JSON.parse(pendingDataStr);
        console.log('Processing pending ticket:', pendingData);

        let avatarFile = null;
        if (pendingData.avatarFile) {
          console.log('Converting base64 back to File...');
          const response = await fetch(pendingData.avatarFile);
          const blob = await response.blob();
          avatarFile = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' });
          console.log('Avatar File recovered');
        }

        const { ticketData } = pendingData;

        if (ticketData.ticketType === 'Premium') {
          console.log('→ Premium ticket after signup');
          await handlePremiumTicket(ticketData, avatarFile);
        } else {
          console.log('→ Standard ticket after signup');
          await createTicketAfterPayment(ticketData, avatarFile);
        }

        toast.success('Your ticket has been created successfully!');
        
      } catch (error) {
        console.error('Error processing pending ticket:', error);
        toast.error('Failed to create pending ticket: ' + (error.message || 'Unknown error'));
        // Optional: you can put pendingDataStr back if you want retry capability
      }
    })();
  }, [currentUser]); // ← keep dependency, but the removeItem makes it safe




  // Clear error message
  const clearError = () => setError(null);

  // MAIN HANDLER: User clicks "Generate & Save Ticket"
  const handleTicketSubmit = async (ticketData, avatarFile) => {
    try {
      console.log('Ticket submission started:', ticketData);
      console.log('Current user:', currentUser ? currentUser.uid : 'NOT LOGGED IN');
      




      if (!currentUser) {
        console.log('User not logged in → preparing pending ticket data...');

        let pendingData = {
          ticketData,
          avatarFile: null
        };

        // Handle avatar if one was uploaded
        if (avatarFile) {
          try {
            console.log('Converting avatar to base64 for session storage...');
            
            const avatarBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => reject(new Error("Failed to read avatar file"));
              reader.readAsDataURL(avatarFile);
            });

            pendingData.avatarFile = avatarBase64;
            console.log('Avatar successfully converted to base64');
            
          } catch (err) {
            console.warn('Failed to convert avatar to base64, continuing without it', err);
            // We continue anyway — better to create ticket without avatar than block the flow
          }
        }

        // Store and redirect
        sessionStorage.setItem('pendingTicketData', JSON.stringify(pendingData));
        console.log('Pending ticket data stored in sessionStorage');
        
        navigate('/register');
        return;
      }






      
      // Check ticket type
      if (ticketData.ticketType === 'Premium') {
        console.log('Premium ticket detected, initiating payment...');
        await handlePremiumTicket(ticketData, avatarFile);
      } else {
        console.log('Standard (free) ticket, creating directly...');
        await createTicketAfterPayment(ticketData, avatarFile);
      }
      
    } catch (error) {
      console.error('Error handling ticket submission:', error);
      setError('Failed to process ticket: ' + error.message);
      toast.error('Failed to process ticket: ' + error.message);
    }
  };

  // Handle Premium tickets - Show payment modal
  const handlePremiumTicket = async (ticketData, avatarFile) => {
    try {
      console.log('Creating payment intent for Premium ticket...');
      
      // Store ticket data for after payment
      setPendingTicketData({ ticketData, avatarFile });
      
      // Create payment intent via backend
      const response = await fetch('http://localhost:5000/api/tickets/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketType: ticketData.ticketType,
          ticketData: {
            eventName: ticketData.eventName,
            userName: ticketData.fullName,
            userEmail: ticketData.email,
            ticketId: 'PENDING'
          }
        })
      });
      
      const paymentData = await response.json();
      console.log('Payment data received:', paymentData);
      
      if (paymentData.requiresPayment) {
        console.log('Payment required, showing modal...');
        setPaymentIntent(paymentData.clientSecret);
        setShowPaymentModal(true);
        toast.success('Please complete payment to generate your ticket');
      } else {
        // Should not happen for Premium, but handle gracefully
        console.log('Premium ticket but no payment required?');
        await createTicketAfterPayment(ticketData, avatarFile);
      }
      
    } catch (error) {
      console.error('Error handling premium ticket:', error);
      toast.error('Failed to initiate payment: ' + error.message);
      throw error;
    }
  };

  // Create ticket in Firestore (called after payment or directly for Standard)
    const createTicketAfterPayment = async (ticketData, avatarFile) => {
  // Prevent duplicate calls
    if (isSubmitting) {
      console.log(' Already creating ticket, skipping...');
      return;
    }
  
    try {
    console.log(' Creating ticket in Firestore...');
    setIsSubmitting(true);
    setError(null);
    setEmailStatus('');
    
    // Generate unique ticket ID and check if it exists
    let ticketId = generateTicketId();
    let ticketRef = doc(db, 'tickets', ticketId);
    let ticketSnap = await getDoc(ticketRef);

    // If ticket exists, generate a new ID
    while (ticketSnap.exists()) {
      console.log(' Ticket ID collision, generating new ID...');
      ticketId = generateTicketId();
      ticketRef = doc(db, 'tickets', ticketId);
      ticketSnap = await getDoc(ticketRef);
    }

    const finalTicketData = {
      ticketId: ticketId,
      fullName: ticketData.fullName,
      email: ticketData.email,
      eventName: ticketData.eventName,
      eventDate: ticketData.eventDate,
      eventTime: ticketData.eventTime,
      location: ticketData.location,
      ticketType: ticketData.ticketType,
      status: 'active',
      checkedIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: ticketData.fullName,
    };


    // Convert avatar to base64 and add to ticket data
    if (avatarFile) {
      const reader = new FileReader();
      const avatarBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(avatarFile);
      });
      finalTicketData.avatarUrl = avatarBase64;
      console.log(' Avatar converted to base64 and added to ticket');
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'tickets'), finalTicketData);
    finalTicketData.id = docRef.id;

    console.log(' Ticket created in Firestore with ID:', docRef.id);
    console.log(' Ticket ID:', finalTicketData.ticketId);
    console.log(' Full ticket data:', finalTicketData);

    setCreatedTicket(finalTicketData);
    if (avatarFile) {
      setAvatarFile(avatarFile);
      console.log(' Avatar file set in state');
    } else if (finalTicketData.avatarUrl) {
      
      console.log(' Using avatarUrl from ticket data');
    }

    // Add to context
    addTicket(finalTicketData);


    // Show success notification immediately
    toast.success('Ticket created successfully!');


    // EMAIL DELIVERY LOGIC - UPDATED WITH FULL ALGORITHM
    try {
      console.log(' Starting email delivery process...');
      
      const formEmail = ticketData.email; // Email from the ticket form
      const accountEmail = currentUser.email; // User's account email
      const isNewUser = sessionStorage.getItem('isNewUser') === 'true';
      
      console.log(' Email Logic Check:', {
        formEmail,
        accountEmail,
        isNewUser,
        sameEmail: formEmail === accountEmail
      });
      
      // STEP 1: Send Welcome Email (only for new users)
      if (isNewUser) {
        console.log(' Sending welcome email to new user:', accountEmail);
        setEmailStatus(' Sending welcome email...');
        
        try {
          const welcomeResponse = await fetch('http://localhost:5000/api/email/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: accountEmail,
              name: currentUser.displayName || ticketData.fullName
            })
          });
          
          const welcomeResult = await welcomeResponse.json();
          if (welcomeResult.success) {
            console.log(' Welcome email sent successfully');
          }
        } catch (welcomeError) {
          console.error(' Welcome email failed:', welcomeError);
        }
        
        // Clear the new user flag
        sessionStorage.removeItem('isNewUser');
      }
      
      // STEP 2: Send Ticket Email(s)
      if (formEmail === accountEmail) {
        // CASE A: SAME EMAIL - Send to one email only
        console.log(' Form email = Account email. Sending ticket to:', accountEmail);
        setEmailStatus(' Sending your ticket via email...');

        // Generate PDF from ticket preview
        console.log(' Generating PDF for email...');
        let pdfBase64 = null;
        try {
          // Wait for React to update the ticket preview with real ticket ID
          console.log(' Waiting for ticket preview to update...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const ticketElement = document.querySelector('[data-ticket-preview]');
          if (ticketElement) {
            console.log(' Ticket element found, generating PDF...');
            pdfBase64 = await generateTicketPDFBuffer(ticketElement);
            console.log(' PDF generated for email');
          } else {
            console.warn(' Ticket element not found, using fallback PDF');
          }
        } catch (pdfError) {
          console.error(' PDF generation failed:', pdfError);
        }

        const ticketResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/email/send-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketData: finalTicketData,
            pdfBase64: pdfBase64
          })
        });
        
        const ticketResult = await ticketResponse.json();
        if (ticketResult.success) {
          console.log(' Ticket email sent to:', accountEmail);
          setEmailStatus(` Ticket sent to ${accountEmail}!`);
          toast.success('Ticket sent to your email!');
        } else {
          throw new Error('Ticket email failed');
        }
        
        } else {
          // CASE B: DIFFERENT EMAILS - Send to both
          console.log(' Form email ≠ Account email. Sending to BOTH emails');
          console.log(' Account email:', accountEmail);
          console.log(' Form email:', formEmail);
          setEmailStatus(' Sending ticket to multiple emails...');
          
          // Wait for React to update the ticket preview with real ticket ID
          console.log(' Waiting for ticket preview to update...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Generate PDF from ticket preview
          console.log(' Generating PDF for email...');
          let pdfBase64 = null;
          try {
            const ticketElement = document.querySelector('[data-ticket-preview]');
            if (ticketElement) {
              console.log(' Ticket element found, generating PDF...');
              pdfBase64 = await generateTicketPDFBuffer(ticketElement);
              console.log(' PDF generated for email');
            } else {
              console.warn(' Ticket element not found, using fallback PDF');
            }
          } catch (pdfError) {
            console.error(' PDF generation failed:', pdfError);
            console.error(' Error details:', pdfError.message, pdfError.stack);
          }
          
          // Send to account email
          const accountEmailResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/email/send-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketData: { ...finalTicketData, email: accountEmail },
              pdfBase64: pdfBase64
            })
          });
          
          // Send to form email
          const formEmailResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/email/send-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketData: finalTicketData,
              pdfBase64: pdfBase64
            })
          });
          
          const accountResult = await accountEmailResponse.json();
          const formResult = await formEmailResponse.json();
          
          if (accountResult.success && formResult.success) {
            console.log(' Ticket emails sent to both addresses');
            setEmailStatus(` Ticket sent to ${accountEmail} and ${formEmail}!`);
            toast.success('Ticket sent to both email addresses!');
          } else if (accountResult.success || formResult.success) {
            console.log(' Ticket sent to one email only');
            setEmailStatus(' Ticket sent to one email (check spam folder for the other)');
            toast.warning('Ticket partially sent. Check your spam folder.');
          } else {
            throw new Error('Both ticket emails failed');
          }
        }
      
    } catch (emailError) {
      console.error(' Email delivery failed:', emailError);
      setEmailStatus(' Email delivery failed. Your ticket is saved in your dashboard.');
      toast.error('Ticket saved but email failed. Check your dashboard.');
      // Don't throw - ticket is already created and saved
    }

    
    } catch (error) {
      console.error(' Error creating ticket:', error);
      setError(error.message);
      toast.error('Failed to create ticket.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
};

  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntentResult) => {
    console.log('Payment successful!', paymentIntentResult);
    
    setShowPaymentModal(false);
    toast.success('Payment successful!');
    
    // Create the ticket now that payment is complete
    if (pendingTicketData) {
      await createTicketAfterPayment(
        pendingTicketData.ticketData,
        pendingTicketData.avatarFile
      );
    }
    
    // Clear pending data
    setPendingTicketData(null);
    setPaymentIntent(null);
  };

  // Handle payment cancellation
  const handlePaymentCancel = () => {
    console.log('Payment cancelled');
    setShowPaymentModal(false);
    setPendingTicketData(null);
    setPaymentIntent(null);
    toast.error('Payment cancelled. The ticket was not created.');
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
          Create tickets with QR codes, email delivery, and validation. 
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
                {createdTicket ? 'Ticket Generated!' : 'Create Your Ticket'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {createdTicket 
                  ? 'Your ticket has been generated and saved. You can download it or view it in your dashboard.' 
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
              
              {!createdTicket ? (
                <TicketForm 
                  onPreviewUpdate={handlePreviewUpdate}
                  onSubmitSuccess={handleTicketSubmit}
                  initialData={ticketData}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-green-800 dark:text-green-400 font-medium">
                      Ticket created and saved successfully!
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                      <strong>Ticket ID:</strong> {createdTicket.ticketId}
                      <br />
                      <strong>Status:</strong> {createdTicket.status}
                      <br />
                      Your ticket has been saved to your account and will appear in your dashboard!
                    </p>
                  </div>


                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Features */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-blue-600 dark:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-blue-300 dark:bg-blue-900 rounded-lg flex items-center justify-center">
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
                <div className="w-10 h-10 bg-green-300 dark:bg-green-900 rounded-lg flex items-center justify-center">                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                ticketData={createdTicket || ticketData}
                avatarFile={avatarFile}
                showDownload={!!createdTicket}
                isGenerated={!!createdTicket}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && paymentIntent && (
        <Modal
          isOpen={showPaymentModal}
          onClose={handlePaymentCancel}
          title="Complete Payment"
          size="md"
        >
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: paymentIntent,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <PaymentForm
              amount={4.99}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          </Elements>
        </Modal>
      )}
    </div>
  );
}