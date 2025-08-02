// src/pages/TicketValidation.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Clock, ArrowLeft, UserPlus } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

export default function TicketValidation() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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
      
      // Call your backend API to get ticket details
      const response = await api.getTicket(ticketId);
      
      if (response.success) {
        setTicket(response.ticket);
      } else {
        setError('Ticket not found or invalid');
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError('Failed to load ticket information');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      
      // Call your backend API to check in the ticket
      const response = await api.checkInTicket(ticketId);
      
      if (response.success) {
        setTicket(prev => ({ ...prev, checkedIn: true, checkedInAt: new Date().toISOString() }));
      } else {
        setError(response.message || 'Failed to check in ticket');
      }
    } catch (err) {
      console.error('Error checking in ticket:', err);
      setError('Failed to check in ticket');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Check if ticket belongs to the current user
  const isUserTicket = () => {
    if (!currentUser || !ticket) return false;
    return ticket.userId === currentUser.uid || ticket.email === currentUser.email;
  };

  // Check if user can enter the event
  const canEnterEvent = () => {
    return currentUser && ticket && ticket.status === 'active' && isUserTicket();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner text="Loading ticket information..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {canEnterEvent() ? 'Entry Successful!' : 'Ticket Validation'}
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
              <Button onClick={() => navigate('/')} variant="outline">
                <ArrowLeft size={16} className="mr-2" />
                Back to Home
              </Button>
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
                <Button 
                  onClick={() => navigate('/register')} 
                  className="w-full"
                  size="lg"
                >
                  Create Free Account
                </Button>
                <Button 
                  onClick={() => navigate('/login')} 
                  variant="outline" 
                  className="w-full"
                >
                  Already have an account? Sign In
                </Button>
                <Button 
                  onClick={() => navigate('/')} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Home
                </Button>
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
                    <span className="font-medium text-gray-900 dark:text-white">{ticket?.email || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  className="w-full"
                  size="lg"
                >
                  View My Tickets
                </Button>
                <Button 
                  onClick={() => navigate('/')} 
                  variant="outline" 
                  className="w-full"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Create New Ticket
                </Button>
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
                  {ticket.checkedIn ? 'Already Checked In' : 'Entry Successful!'}
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
                    <Button 
                      onClick={handleCheckIn} 
                      disabled={checkingIn}
                      className="w-full"
                      size="lg"
                    >
                      {checkingIn ? 'Checking In...' : 'Complete Check-In'}
                    </Button>
                  )}
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => navigate('/dashboard')} 
                      variant="outline" 
                      className="flex-1"
                    >
                      View Dashboard
                    </Button>
                    <Button 
                      onClick={() => navigate('/')} 
                      variant="outline" 
                      className="flex-1"
                    >
                      <ArrowLeft size={16} className="mr-2" />
                      Home
                    </Button>
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