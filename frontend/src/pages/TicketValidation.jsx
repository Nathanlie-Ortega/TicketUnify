// src/pages/TicketValidation.jsx - Fixed with proper Firebase integration
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Clock, ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

export default function TicketValidation() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { updateTicketCheckin } = useTickets();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  // Fetch ticket details when component mounts
  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 Fetching ticket details for:', ticketId);
      
      // Query Firestore for ticket by ticketId
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('ticketId', '==', ticketId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('❌ No ticket found with ID:', ticketId);
        setError('Ticket not found or invalid');
        return;
      }
      
      // Get the first (should be only) ticket
      const ticketDoc = querySnapshot.docs[0];
      const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };
      
      console.log('✅ Found ticket:', ticketData);
      setTicket(ticketData);
      
    } catch (err) {
      console.error('❌ Error fetching ticket:', err);
      setError('Failed to load ticket information');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!ticket || !currentUser) return;
    
    try {
      setCheckingIn(true);
      console.log('✅ Checking in ticket:', ticket.id);
      
      // Update in Firestore directly
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        checkedIn: true,
        checkedInAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Update local state
      setTicket(prev => ({ 
        ...prev, 
        checkedIn: true, 
        checkedInAt: new Date().toISOString() 
      }));
      
      // Update context if available
      if (updateTicketCheckin) {
        await updateTicketCheckin(ticket.id, true);
      }
      
      console.log('🎉 Check-in completed successfully!');
      
    } catch (err) {
      console.error('❌ Error checking in ticket:', err);
      setError('Failed to check in ticket');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString + 'T00:00:00'); // Add time to prevent timezone issues
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Check if ticket belongs to the current user
  const isUserTicket = () => {
    if (!currentUser || !ticket) return false;
    return ticket.userId === currentUser.uid || 
           ticket.userEmail === currentUser.email || 
           ticket.email === currentUser.email;
  };

  // Check if user can enter the event
  const canEnterEvent = () => {
    return currentUser && ticket && ticket.status === 'active' && isUserTicket();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading ticket information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {canEnterEvent() && !error ? 'Entry Successful!' : 'Ticket Validation'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Ticket ID: <span className="font-mono text-sm">{ticketId}</span>
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-600 dark:border-gray-700 overflow-hidden">
          {error ? (
            /* Error State - Ticket Not Found */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                Invalid Ticket
              </h2>
              <p className="text-red-700 dark:text-red-300 mb-6">
                {error}
              </p>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Home
              </button>
            </div>
          ) : !currentUser ? (
            /* Not Signed In - Require Signup */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Sign Up Required
              </h2>
              <p className="text-yellow-700 dark:text-yellow-300 mb-6">
                You need to create an account to confirm your entry and prevent ticket reuse by others.
              </p>
              
              {ticket && (
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ticket Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Event:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.eventName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatDate(ticket.eventDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Location:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.ticketType}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/register')} 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Free Account
                </button>
                <button 
                  onClick={() => navigate('/login')} 
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Already have an account? Sign In
                </button>
                <button 
                  onClick={() => navigate('/')} 
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Back to Home
                </button>
              </div>
            </div>
          ) : currentUser && ticket && !isUserTicket() ? (
            /* Signed In But Wrong Ticket */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Ticket Not Found in Your Account
              </h2>
              <p className="text-yellow-700 dark:text-yellow-300 mb-6">
                This ticket doesn't belong to your account. Only the ticket owner can use this ticket for entry.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Account Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Your Account:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{currentUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ticket Owner:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket?.email || ticket?.userEmail || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/dashboard')} 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View My Tickets
                </button>
                <button 
                  onClick={() => navigate('/')} 
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Create New Ticket
                </button>
              </div>
            </div>
          ) : canEnterEvent() ? (
            /* Valid Ticket - User Owns This Ticket */
            <div>
              {/* Status Header */}
              <div className={`p-6 text-center ${
                ticket.checkedIn 
                  ? 'bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800' 
                  : 'bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800'
              }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  ticket.checkedIn 
                    ? 'bg-green-100 dark:bg-green-900/40' 
                    : 'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  <CheckCircle size={32} className={`${
                    ticket.checkedIn 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-blue-600 dark:text-blue-400'
                  }`} />
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  ticket.checkedIn 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-blue-900 dark:text-blue-100'
                }`}>
                  {ticket.checkedIn ? 'Already Checked In' : 'Check-in Successful!'}
                </h2>
                <p className={`${
                  ticket.checkedIn 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {ticket.checkedIn 
                    ? `Previously checked in on ${formatDate(ticket.checkedInAt)}` 
                    : 'Welcome! Enjoy the event!'
                  }
                </p>
              </div>

              {/* Ticket Details */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Ticket Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Attendee Name:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.fullName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Event:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.eventName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(ticket.eventDate)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Location:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.location}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Ticket Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.ticketType}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      ticket.checkedIn 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {ticket.checkedIn ? 'Checked In' : 'Valid - Entry Confirmed'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 space-y-3">
                  {!ticket.checkedIn && (
                    <button 
                      onClick={handleCheckIn} 
                      disabled={checkingIn}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {checkingIn ? 'Checking In...' : 'Complete Check-In'}
                    </button>
                  )}
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => navigate('/dashboard')} 
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      View Dashboard
                    </button>
                    <button 
                      onClick={() => navigate('/')} 
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ArrowLeft size={16} className="mr-2 inline" />
                      Home
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {!currentUser ? (
            <p>Sign up to secure your entry and prevent ticket reuse</p>
          ) : canEnterEvent() ? (
            <p>Your entry has been confirmed. Enjoy the event!</p>
          ) : (
            <p>This ticket is not associated with your account</p>
          )}
        </div>
      </div>
    </div>
  );
}