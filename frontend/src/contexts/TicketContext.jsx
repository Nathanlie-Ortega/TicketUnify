// src/contexts/TicketContext.jsx
import React, { createContext, useContext, useState } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  updateDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../utils/firebase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const TicketContext = createContext();

export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
}

export function TicketProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  // Generate unique ticket ID
  function generateTicketId() {
    return `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Upload avatar image to Firebase Storage
  async function uploadAvatar(file, ticketId) {
    try {
      const avatarRef = ref(storage, `avatars/${ticketId}-${file.name}`);
      const snapshot = await uploadBytes(avatarRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  // Create new ticket
  async function createTicket(ticketData, avatarFile = null) {
    if (!currentUser) {
      throw new Error('User must be authenticated to create tickets');
    }

    setLoading(true);
    try {
      const ticketId = generateTicketId();
      let avatarUrl = null;

      // Upload avatar if provided
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile, ticketId);
      }

      const ticket = {
        id: ticketId,
        userId: currentUser.uid,
        userName: ticketData.fullName,
        userEmail: ticketData.email,
        eventName: ticketData.eventName,
        eventDate: ticketData.eventDate,
        eventLocation: ticketData.eventLocation,
        ticketType: ticketData.ticketType || 'Standard',
        avatarUrl,
        qrCode: ticketId, // QR code contains the ticket ID
        checkedIn: false,
        checkedInAt: null,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Save to Firestore
      await setDoc(doc(db, 'tickets', ticketId), ticket);
      
      // Send email with ticket (you'll implement this in the backend)
      await sendTicketEmail(ticket);
      
      toast.success('Ticket created successfully!');
      return ticket;
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // Get ticket by ID
  async function getTicket(ticketId) {
    try {
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (ticketDoc.exists()) {
        return ticketDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching ticket:', error);
      throw error;
    }
  }

  // Get user's tickets
  async function getUserTickets() {
    if (!currentUser) return [];

    try {
      const q = query(
        collection(db, 'tickets'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const userTickets = [];
      querySnapshot.forEach((doc) => {
        userTickets.push(doc.data());
      });
      
      setTickets(userTickets);
      return userTickets;
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      throw error;
    }
  }

  // Validate and check-in ticket
  async function checkInTicket(ticketId) {
    try {
      const ticket = await getTicket(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      
      if (ticket.checkedIn) {
        throw new Error('Ticket already checked in');
      }
      
      if (ticket.status !== 'active') {
        throw new Error('Ticket is not active');
      }

      // Update ticket status
      await updateDoc(doc(db, 'tickets', ticketId), {
        checkedIn: true,
        checkedInAt: new Date().toISOString()
      });

      toast.success('Ticket checked in successfully!');
      return { ...ticket, checkedIn: true };
    } catch (error) {
      console.error('Error checking in ticket:', error);
      toast.error(error.message);
      throw error;
    }
  }

  // Send ticket email (placeholder - implement with Cloud Functions)
  async function sendTicketEmail(ticket) {
    try {
      // This would typically be a Cloud Function or API call
      console.log('Sending ticket email for:', ticket.id);
      // Implementation depends on your email service
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  // Get all tickets (admin only)
  async function getAllTickets() {
    try {
      const q = query(
        collection(db, 'tickets'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const querySnapshot = await getDocs(q);
      const allTickets = [];
      querySnapshot.forEach((doc) => {
        allTickets.push(doc.data());
      });
      
      return allTickets;
    } catch (error) {
      console.error('Error fetching all tickets:', error);
      throw error;
    }
  }

  const value = {
    tickets,
    loading,
    createTicket,
    getTicket,
    getUserTickets,
    checkInTicket,
    getAllTickets
  };

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
}