// src/pages/TicketValidation.jsx - Fixed with proper temporary ticket handling
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
  const [isTemporaryTicket, setIsTemporaryTicket] = useState(false);

  // Fetch ticket details when component mounts
  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log(' Fetching ticket details for:', ticketId);
      
      // First, check for temporary ticket in localStorage
      const tempTicketData = localStorage.getItem(`temp-ticket-${ticketId}`);
      if (tempTicketData) {
        try {
          const tempTicket = JSON.parse(tempTicketData);
          console.log(' Found temporary ticket:', tempTicket);
          setTicket(tempTicket);
          setIsTemporaryTicket(true);
          setLoading(false);
          return;
        } catch (e) {
          console.warn('Failed to parse temporary ticket data');
        }
      }
      
      // If no temporary ticket, query Firestore for permanent ticket
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('ticketId', '==', ticketId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(' No ticket found with ID:', ticketId);
        setError('Ticket not found');
        return;
      }
      
      // Get the first (should be only) ticket
      const ticketDoc = querySnapshot.docs[0];
      const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };
      
      console.log(' Found permanent ticket:', ticketData);
      setTicket(ticketData);
      setIsTemporaryTicket(false);
      
    } catch (err) {
      console.error(' Error fetching ticket:', err);
      setError('Failed to load ticket information');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!ticket || !currentUser || isTemporaryTicket) return;
    
    try {
      setCheckingIn(true);
      console.log(' Checking in ticket:', ticket.id);
      
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
      
      console.log(' Check-in completed successfully!');
      
    } catch (err) {
      console.error(' Error checking in ticket:', err);
      setError('Failed to check in ticket');
    } finally {
      setCheckingIn(false);
    }
  };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString + 'T00:00:00');
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

    const formatTime = (timeString) => {
      if (!timeString) return 'N/A';
      try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      } catch (error) {
        return timeString;
      }
    };


  // Check if ticket is expired (event time + 30 min grace period)
  const isTicketExpired = (ticketData) => {
    if (!ticketData || !ticketData.eventDate || !ticketData.eventTime) return false;

    try {
      // Combine date and time into a single datetime
      const eventDateTime = new Date(`${ticketData.eventDate}T${ticketData.eventTime}:00`);
      
      // Add 30-minute grace period
      const gracePeriodMinutes = 30;
      const expirationTime = new Date(eventDateTime.getTime() + (gracePeriodMinutes * 60 * 1000));
      
      // Check if current time is past the expiration time
      const now = new Date();
      return now > expirationTime;
    } catch (error) {
      console.error('Error checking ticket expiration:', error);
      return false;
    }
  };

  // Check if ticket belongs to the current user (only for permanent tickets)
  const isUserTicket = () => {
    if (!currentUser || !ticket || isTemporaryTicket) return false;
    return ticket.userId === currentUser.uid || 
           ticket.userEmail === currentUser.email || 
           ticket.email === currentUser.email;
  };

  // Check if user can enter the event
    const canEnterEvent = () => {
      // Allow check-in if user is logged in AND (owns ticket OR is admin)
      if (!currentUser || !ticket || isTemporaryTicket) return false;
      if (ticket.status !== 'active' || isTicketExpired(ticket)) return false;
      
      const isOwner = isUserTicket();
      const isAdmin = currentUser.email === 'admin@ticketunify.com'; // Update with your admin email
      
      return isOwner || isAdmin;
    };

    const canViewTicket = () => {
      return ticket && !isTemporaryTicket;
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
            Ticket Validation
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Ticket ID: <span className="font-mono text-sm">{ticketId}</span>
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-600 dark:border-gray-700 overflow-hidden">
          {error && !ticket ? (
            /* Error State - Ticket Not Found */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                Ticket Not Found
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
          ) : isTemporaryTicket ? (
            /* Temporary Ticket - Requires Signup */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Temporary Ticket - Signup Required
              </h2>
              <p className="text-yellow-700 dark:text-yellow-300 mb-6">
                This is a temporary ticket. You must sign up to confirm your entry and enable check-in validation.
              </p>
              
              {ticket && (
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ticket Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Attendee:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Event:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.eventName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatDate(ticket.eventDate)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Time:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatTime(ticket.eventTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Location:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ticket.ticketType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="font-medium text-yellow-600 dark:text-yellow-400">Temporary</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Sign up to unlock:</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 text-left">
                  <li>✓ Permanent ticket storage</li>
                  <li>✓ Check-in validation</li>
                  <li>✓ Email delivery</li>
                  <li>✓ Access from any device</li>
                  <li>✓ Event entry confirmation</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/register', { 
                    state: { 
                      fromValidation: true, 
                      ticketId: ticketId 
                    } 
                  })} 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Up to Confirm Entry
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


          ) : !currentUser ? (
            /* Not Logged In - Public View with Sign In Prompt */
            <div>
              {/* Status Header */}
              <div className="p-6 text-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-100 dark:bg-blue-900/40">
                  <CheckCircle size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Valid Ticket
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Sign in to check in this ticket
                </p>
              </div>

              {/* Ticket Details - Public View */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Ticket Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Event:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.eventName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(ticket.eventDate)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      ticket.checkedIn 
                        ? 'text-green-600 dark:text-green-400' 
                        : isTicketExpired(ticket)
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {ticket.checkedIn ? 'Checked In' : isTicketExpired(ticket) ? 'Expired' : 'Valid'}
                    </span>
                  </div>
                </div>

                {/* Sign In Prompt */}
                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-600 dark:border-blue-800 text-center">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                    Sign in required to check in this ticket
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">
                    This ticket is valid. Sign in with your account to complete check-in. Make sure the account you login is the correct email you generated with the ticket.
                  </p>
                  
                  <button 
                    onClick={() => navigate('/login', { state: { from: { pathname: `/validate/${ticketId}` } } })}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Sign In to Check In
                  </button>
                </div>

                {/* Navigation */}
                <div className="mt-4">
                  <button 
                    onClick={() => navigate('/')} 
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ArrowLeft size={16} className="mr-2 inline" />
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          ) : currentUser && ticket && !isUserTicket() ? (
            /* Logged In as WRONG USER - Limited Info */
            <div>
              {/* Status Header */}
              <div className="p-6 text-center bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/40">
                  <AlertCircle size={32} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-yellow-900 dark:text-yellow-100">
                  Not Your Ticket
                </h2>
                <p className="text-yellow-700 dark:text-yellow-300">
                  This ticket belongs to another account
                </p>
              </div>

              {/* Limited Ticket Details - NO EMAILS SHOWN */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Ticket Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Event:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{ticket.eventName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(ticket.eventDate)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Valid Ticket</span>
                  </div>
                </div>

                {/* Message - NO ACCOUNT INFO */}
                <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Only the ticket owner can check in this ticket. Sign in with the correct account.
                  </p>
                </div>

                {/* Navigation */}
                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={() => navigate('/dashboard')} 
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    My Tickets
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





            ) : currentUser && ticket && isUserTicket() && isTicketExpired(ticket) ? (

                /* Expired Ticket */
                <div>
                  {/* Expired Status Header */}
                  <div className="p-6 text-center bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                      Ticket Expired
                    </h2>
                    <p className="text-red-700 dark:text-red-300">
                      This ticket has expired and cannot be used for entry. The event grace period has passed.
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
                        <span className="text-gray-600 dark:text-gray-400">Time:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatTime(ticket.eventTime)}</span>
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
                        <span className="font-medium text-red-600 dark:text-red-400">
                          Expired - Entry Denied
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 space-y-3">
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
                  {ticket.checkedIn ? 'Check-in Successful!' : 'Make sure to Complete Check-in!'}
                </h2>
                <p className={`${
                  ticket.checkedIn 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {ticket.checkedIn 
                    ? '' 
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
                    <span className="text-gray-600 dark:text-gray-400">Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatTime(ticket.eventTime)}</span>
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
                        : isTicketExpired(ticket)
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {ticket.checkedIn ? 'Checked In' : isTicketExpired(ticket) ? 'Expired - Entry Denied' : 'Valid - Entry Confirmed'}
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

            ) : canViewTicket() ? (
  /* Public View - Anyone can see ticket details but not check in */
  <div>
    {/* Status Header - Read Only */}
    <div className="p-6 text-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-100 dark:bg-gray-700">
        <CheckCircle size={32} className="text-gray-600 dark:text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
        Ticket Details
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        {ticket.checkedIn ? 'This ticket has been checked in' : 'Valid ticket'}
      </p>
    </div>

    {/* Ticket Details */}
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Ticket Information</h3>
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
          <span className="text-gray-600 dark:text-gray-400">Time:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatTime(ticket.eventTime)}</span>
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
              : isTicketExpired(ticket)
              ? 'text-red-600 dark:text-red-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            {ticket.checkedIn ? 'Checked In' : isTicketExpired(ticket) ? 'Expired' : 'Valid'}
          </span>
        </div>
      </div>

            {/* Action Buttons */}
            <div className="mt-8 space-y-3">
              {!currentUser ? (
                <div className="text-center py-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">Sign in to check in this ticket</p>
                  <button 
                    onClick={() => navigate('/login', { state: { from: { pathname: `/validate/${ticketId}` } } })}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus size={16} className="mr-2" />
                    Sign In
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to check in this ticket</p>
                </div>
              )}
              
              <div className="flex gap-3">
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
          {isTemporaryTicket ? (
            <p>This is a temporary ticket. Sign up to confirm your entry and enable full validation.</p>
          ) : !currentUser ? (
            <p>Sign in to secure your entry and prevent ticket reuse</p>
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