// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import { Ticket, QrCode, Download, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { tickets, getUserTickets, loading } = useTickets();
  const [activeTab, setActiveTab] = useState('tickets');

  useEffect(() => {
    if (currentUser) {
      getUserTickets();
    }
  }, [currentUser]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const getTicketStatusColor = (ticket) => {
    if (ticket.checkedIn) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (ticket.status === 'active') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  };

  const getTicketStatusText = (ticket) => {
    if (ticket.checkedIn) return 'Checked In';
    if (ticket.status === 'active') return 'Active';
    return 'Inactive';
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {userProfile?.fullName || currentUser?.displayName}!
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your tickets and view your event history
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <QrCode className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Checked In</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {tickets.filter(t => t.checkedIn).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Events</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {tickets.filter(t => new Date(t.eventDate) > new Date()).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'tickets'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Profile
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tickets' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tickets yet</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You haven't generated any tickets yet. Create your first ticket to get started.
              </p>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Ticket
              </a>
            </div>
          ) : (
            <div className="grid gap-6">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {ticket.eventName}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTicketStatusColor(ticket)}`}>
                            {getTicketStatusText(ticket)}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span>{formatDate(ticket.eventDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} />
                            <span>{ticket.eventLocation}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ticket size={16} />
                            <span>{ticket.ticketType} Ticket</span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-6 text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Ticket ID</p>
                        <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                          #{ticket.id.split('-').pop()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Created {formatDate(ticket.createdAt)}
                      </div>
                      <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
                          <QrCode size={16} />
                          View QR
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors">
                          <Download size={16} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{userProfile?.fullName || 'Not provided'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{currentUser?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {userProfile?.createdAt ? formatDate(userProfile.createdAt) : 'Unknown'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tickets Generated</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{tickets.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}