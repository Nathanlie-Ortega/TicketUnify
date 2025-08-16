// src/pages/Dashboard.jsx - Complete fixed version with profile picture support in downloads
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import { Ticket, QrCode, Download, Calendar, MapPin, Trash2, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { tickets, getUserTickets, loading, getTicketStats } = useTickets();
  const [activeTab, setActiveTab] = useState('tickets');
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [downloadingTicket, setDownloadingTicket] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, ticket: null });
  const [ticketAvatars, setTicketAvatars] = useState({});
  const ticketRefs = useRef({});

  useEffect(() => {
    if (currentUser) {
      getUserTickets(true); // Force refresh on mount
    }
  }, [currentUser?.uid]);

  // Load ticket-specific avatars when tickets change
  useEffect(() => {
    const loadTicketAvatars = async () => {
      const avatars = {};
      
      for (const ticket of tickets) {
        try {
          // Try to get avatar from ticket document in Firestore
          if (ticket.id) {
            const ticketDoc = await getDoc(doc(db, 'tickets', ticket.id));
            if (ticketDoc.exists()) {
              const ticketData = ticketDoc.data();
              if (ticketData.avatarUrl) {
                avatars[ticket.id] = ticketData.avatarUrl;
              }
            }
          }
          
          // Fallback: Check localStorage for ticket-specific avatar
          const storedAvatar = localStorage.getItem(`ticket-avatar-${ticket.id}`);
          if (storedAvatar && !avatars[ticket.id]) {
            avatars[ticket.id] = storedAvatar;
          }
          
          // Another fallback: Check if this is a recent ticket
          if (ticket.ticketId) {
            const recentTicketData = localStorage.getItem('recentTicketData');
            if (recentTicketData) {
              try {
                const recentData = JSON.parse(recentTicketData);
                if (recentData.ticketId === ticket.ticketId && recentData.avatarUrl && !avatars[ticket.id]) {
                  avatars[ticket.id] = recentData.avatarUrl;
                }
              } catch (e) {
                console.log('Failed to parse recent ticket data');
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load avatar for ticket ${ticket.id}:`, error);
        }
      }
      
      setTicketAvatars(avatars);
    };

    if (tickets.length > 0) {
      loadTicketAvatars();
    }
  }, [tickets]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get stats from ticket context
  const stats = getTicketStats();

  // Check if user is new (signed up recently) vs returning (sign in)
  const isNewUser = () => {
    if (!currentUser?.metadata) return false;
    const creationTime = new Date(currentUser.metadata.creationTime);
    const lastSignInTime = new Date(currentUser.metadata.lastSignInTime);
    // If account was created within the last hour, consider them new
    const hoursSinceCreation = (Date.now() - creationTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation < 1;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString + 'T00:00:00'); // Add time to prevent timezone issues
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  // Format creation date with proper timezone and 12-hour format
  const formatCreationDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy \'at\' h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  const formatDateForTicket = (dateString) => {
    if (!dateString) return 'Event Date';
    try {
      const date = new Date(dateString + 'T00:00:00');
      return format(date, 'EEEE, MMMM do, yyyy');
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

  // Open delete modal
  const openDeleteModal = (ticket) => {
    setDeleteModal({ isOpen: true, ticket });
    setOpenDropdown(null);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, ticket: null });
  };

  // Delete ticket function with custom modal
  const handleDeleteTicket = async () => {
    if (!deleteModal.ticket) return;
    
    setDeletingTicket(deleteModal.ticket.id);
    
    try {
      console.log('🗑️ Deleting ticket:', deleteModal.ticket.id);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'tickets', deleteModal.ticket.id));
      
      // Clean up ticket-specific avatar storage
      localStorage.removeItem(`ticket-avatar-${deleteModal.ticket.id}`);
      
      // Remove from local state
      setTicketAvatars(prev => {
        const updated = { ...prev };
        delete updated[deleteModal.ticket.id];
        return updated;
      });
      
      // Refresh tickets to update the UI and stats
      await getUserTickets(true);
      
      console.log('✅ Ticket deleted successfully');
      closeDeleteModal();
      
    } catch (error) {
      console.error('❌ Error deleting ticket:', error);
      alert('Failed to delete ticket. Please try again.');
    } finally {
      setDeletingTicket(null);
    }
  };

  // Generate QR code for ticket
  const generateTicketQR = async (ticketId) => {
    try {
      const validationUrl = `${window.location.origin}/validate/${ticketId}`;
      return await QRCode.toDataURL(validationUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };


  // Enhanced render ticket for download with profile picture support
  const renderTicketForDownload = async (ticket) => {
    const qrCodeUrl = await generateTicketQR(ticket.ticketId);
    const avatarUrl = ticketAvatars[ticket.id]; // Get ticket-specific avatar
    
    // Create a temporary container for the ticket
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.innerHTML = `
      <div style="
        width: 560px; 
        height: 400px; 
        background: linear-gradient(135deg, #3b82f6, #1d4ed8, #7c3aed);
        border-radius: 16px;
        position: relative;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <!-- Background Pattern -->
        <div style="
          position: absolute;
          inset: 0;
          opacity: 0.2;
        ">
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" stroke-width="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <!-- Main Content -->
        <div style="
          position: relative;
          padding: 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
          color: white;
        ">
          <!-- Header -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
          ">
            <div style="flex: 1;">
              <h2 style="
                font-size: 18px;
                font-weight: bold;
                margin: 0 0 4px 0;
                line-height: 1.2;
              ">${ticket.eventName}</h2>
              <div style="
                color: rgba(191, 219, 254, 1);
                font-size: 14px;
                display: flex;
                align-items: center;
              ">
                📅 ${formatDateForTicket(ticket.eventDate)}
              </div>
            </div>
            
            <!-- Avatar with profile picture support -->
            <div style="
              width: 64px;
              height: 64px;
              border-radius: 50%;
              border: 3px solid rgba(255, 255, 255, 0.2);
              background: rgba(255, 255, 255, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              margin-left: 16px;
              overflow: hidden;
            ">
              ${avatarUrl ? `
                <img 
                  src="${avatarUrl}" 
                  alt="Profile" 
                  style="
                    width: 100%; 
                    height: 100%; 
                    object-fit: cover;
                    border-radius: 50%;
                  " 
                />
              ` : '👤'}
            </div>
          </div>

          <!-- Attendee Info -->
          <div style="flex: 1; margin-bottom: 16px;">
            <div style="margin-bottom: 12px;">
              <p style="
                color: rgba(191, 219, 254, 1);
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 0 0 4px 0;
              ">ATTENDEE</p>
              <p style="
                font-size: 18px;
                font-weight: 600;
                margin: 0;
              ">${ticket.fullName}</p>
            </div>

            <div style="
              color: rgba(191, 219, 254, 1);
              font-size: 14px;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
            ">
              📍 ${ticket.location}
            </div>

            <div style="
              color: rgba(191, 219, 254, 1);
              font-size: 14px;
              display: flex;
              align-items: center;
            ">
              🎫 ${ticket.ticketType} Ticket
            </div>
          </div>

          <!-- QR Code Section -->
          <div style="
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1;">
              <p style="
                color: rgba(191, 219, 254, 1);
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 0 0 4px 0;
              ">TICKET ID</p>
              <p style="
                font-family: monospace;
                font-size: 14px;
                margin: 0;
              ">#${ticket.ticketId}</p>
            </div>
            
            ${qrCodeUrl ? `
              <div style="
                background: white;
                padding: 8px;
                border-radius: 8px;
                margin-left: 16px;
              ">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 64px; height: 64px; display: block;" />
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Decorative Elements -->
        <div style="
          position: absolute;
          top: 50%;
          left: -16px;
          width: 32px;
          height: 32px;
          background: #f9fafb;
          border-radius: 50%;
          transform: translateY(-50%);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          right: -16px;
          width: 32px;
          height: 32px;
          background: #f9fafb;
          border-radius: 50%;
          transform: translateY(-50%);
        "></div>
      </div>
    `;

    document.body.appendChild(container);
    
    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(container);
      return canvas;
    } catch (error) {
      document.body.removeChild(container);
      throw error;
    }
  };

  // Download as PDF
  const downloadTicketAsPDF = async (ticket) => {
    setDownloadingTicket(ticket.id);
    setOpenDropdown(null);
    try {
      const canvas = await renderTicketForDownload(ticket);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`${ticket.eventName}-ticket.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingTicket(null);
    }
  };

  // Download as Image
  const downloadTicketAsImage = async (ticket) => {
    setDownloadingTicket(ticket.id);
    setOpenDropdown(null);
    try {
      const canvas = await renderTicketForDownload(ticket);
      const link = document.createElement('a');
      link.download = `${ticket.eventName}-ticket.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setDownloadingTicket(null);
    }
  };


  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Welcome vs Welcome Back */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {isNewUser() ? 'Welcome' : 'Welcome back'}, {userProfile?.fullName || currentUser?.displayName || currentUser?.email?.split('@')[0]}!
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your tickets and view your event history
        </p>
      </div>

      {/* Stats Cards with blue borders in light mode */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors border-2 border-blue-600 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors border-2 border-blue-600 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <QrCode className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Checked In</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.checkedInTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors border-2 border-blue-600 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Events</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.upcomingEvents}</p>
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
            <div className="grid gap-8">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-visible transition-colors min-h-[200px] border-2 border-blue-600 dark:border-gray-700">
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
                            <span>{ticket.location}</span>
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
                          #{ticket.ticketId || ticket.id}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between pt-4 border-t-2 border-blue-600 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Created {formatCreationDate(ticket.createdAt)}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.open(`/validate/${ticket.ticketId}`, '_blank')}
                          className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        >
                          <QrCode size={16} />
                          View QR
                        </button>
                        
                        {/* Fixed Dropdown - appears above button with simplified content */}
                        <div className="relative dropdown-container">
                          <button 
                            onClick={() => setOpenDropdown(openDropdown === ticket.id ? null : ticket.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors border-2 border-gray-300 dark:border-gray-600 shadow-sm"
                          >
                            <Download size={16} />
                            Options
                            <MoreVertical size={14} />
                          </button>
                          
                          {/* Simplified Dropdown - no danger zone */}
                          {openDropdown === ticket.id && (
                            <div className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500 rounded-xl shadow-2xl z-[100] overflow-hidden">
                              {/* Download Section */}
                              <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Download Ticket</p>
                              </div>
                              <button
                                onClick={() => downloadTicketAsPDF(ticket)}
                                disabled={downloadingTicket === ticket.id}
                                className="w-full px-4 py-3 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-3 disabled:opacity-50 transition-all duration-200 font-medium"
                              >
                                <Download size={18} className="text-blue-600 dark:text-blue-400" />
                                <span>{downloadingTicket === ticket.id ? 'Generating PDF...' : 'Download as PDF'}</span>
                              </button>
                              <button
                                onClick={() => downloadTicketAsImage(ticket)}
                                disabled={downloadingTicket === ticket.id}
                                className="w-full px-4 py-3 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-3 disabled:opacity-50 transition-all duration-200 font-medium"
                              >
                                <Download size={18} className="text-blue-600 dark:text-blue-400" />
                                <span>{downloadingTicket === ticket.id ? 'Generating PNG...' : 'Download as PNG'}</span>
                              </button>
                              
                              {/* Simple Delete Button */}
                              <hr className="border-gray-200 dark:border-gray-600" />
                              <button
                                onClick={() => openDeleteModal(ticket)}
                                disabled={deletingTicket === ticket.id}
                                className="w-full px-4 py-3 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-3 disabled:opacity-50 transition-all duration-200 font-medium"
                              >
                                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                                <span>Delete Permanently</span>
                              </button>
                            </div>
                          )}
                        </div>
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
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{userProfile?.fullName || currentUser?.displayName || 'Not provided'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{currentUser?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">User ID</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{currentUser?.uid}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {currentUser?.metadata?.creationTime ? formatCreationDate(currentUser.metadata.creationTime) : 'Unknown'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tickets Generated</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{stats.totalTickets}</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                  <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Delete Ticket</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to permanently delete the ticket for{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  "{deleteModal.ticket?.eventName}"
                </span>
                ?
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-4">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ticket ID:</span>
                    <span className="font-mono text-gray-900 dark:text-white">#{deleteModal.ticket?.ticketId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Event Date:</span>
                    <span className="text-gray-900 dark:text-white">{formatDate(deleteModal.ticket?.eventDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Location:</span>
                    <span className="text-gray-900 dark:text-white">{deleteModal.ticket?.location}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  ⚠️ This ticket will be permanently removed from the database and cannot be recovered.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={deletingTicket}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTicket}
                disabled={deletingTicket}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingTicket ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}