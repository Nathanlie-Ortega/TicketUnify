// src/pages/Home.jsx - Everyone can create tickets
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketForm from '../components/TicketForm';
import TicketPreview from '../components/TicketPreview';
import { useAuth } from '../contexts/AuthContext';

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
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Handle real-time preview updates (no backend call)
  const handlePreviewUpdate = (data, file) => {
    console.log('Preview update:', data);
    setTicketData(data);
    setAvatarFile(file);
  };

  // Handle actual form submission (with backend call)
  const handleFormSubmit = (createdTicketData, file) => {
    console.log('🏠 Home received ticket data:', createdTicketData);
    
    const ticketId = createdTicketData.ticketId || createdTicketData.id || `TICKET-${Date.now()}`;
    
    const forcedTicketData = {
      fullName: createdTicketData.fullName || '',
      email: createdTicketData.email || '',
      eventName: createdTicketData.eventName || '',
      eventDate: createdTicketData.eventDate || '',
      location: createdTicketData.location || '',
      ticketType: createdTicketData.ticketType || 'Standard',
      ticketId: ticketId,
      id: ticketId,
      status: 'active',
      userId: currentUser?.uid || 'anonymous', // Link to user if signed in
      userEmail: currentUser?.email || createdTicketData.email,
      createdAt: new Date().toISOString()
    };
    
    console.log('🏠 FORCED ticket data with ID:', forcedTicketData);
    
    setTicketData(forcedTicketData);
    setAvatarFile(file);
    setCreatedTicket(createdTicketData);
    setPreviewMode(true);
    
    setTimeout(() => {
      setTicketData({...forcedTicketData});
    }, 100);
  };

  const handleEdit = () => {
    setPreviewMode(false);
    setCreatedTicket(null);
  };

  // FIXED: Navigate to register page instead of login
  const handleSignUp = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      {/* Hero Section */}
      <div className="text-center py-12 mb-8">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
          Conference Ticket
          <span className="text-blue-600 dark:text-blue-400"> Generator</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
          Create professional conference tickets with QR codes, email delivery, and validation. 
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
              
              {!previewMode ? (
                <TicketForm 
                  onPreviewUpdate={handlePreviewUpdate}
                  onSubmitSuccess={handleFormSubmit}
                  initialData={ticketData}
                />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-green-800 dark:text-green-400 font-medium">
                      ✓ Ticket created and saved successfully!
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                      {createdTicket && (
                        <>
                          <strong>Ticket ID:</strong> {createdTicket.ticketId || createdTicket.id}
                          <br />
                          <strong>Status:</strong> {createdTicket.status}
                          <br />
                          {currentUser 
                            ? 'Your ticket has been saved to your account and emailed to you.' 
                            : 'Sign up to save tickets permanently and enable email delivery.'
                          }
                        </>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleEdit}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      ← Edit Details
                    </button>
                    
                    {!currentUser ? (
                      <button
                        onClick={handleSignUp}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Sign Up to Save
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Email Delivery</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Instant PDF tickets</p>
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

      {/* Footer */}
      <div className="mt-16 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Create professional tickets for your next event
        </p>
      </div>
    </div>
  );
}