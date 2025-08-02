// src/contexts/TicketContext.jsx - Updated with delete functionality
import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from './AuthContext';

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
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  // Simple fetch - get ALL tickets and filter client-side (no indexes needed)
  const getUserTickets = async (forceRefresh = false) => {
    if (!currentUser) {
      console.log('👤 No current user, clearing tickets');
      setTickets([]);
      return;
    }

    // Don't fetch if we already have tickets and this isn't a forced refresh
    if (tickets.length > 0 && !forceRefresh) {
      console.log('🎫 Using cached tickets');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching ALL tickets (no complex queries)...');
      console.log('👤 Current user:', {
        uid: currentUser.uid,
        email: currentUser.email
      });
      
      // Simple query - just get ALL tickets (no where/orderBy clauses)
      const ticketsRef = collection(db, 'tickets');
      const allTicketsSnapshot = await getDocs(ticketsRef);
      
      console.log('📊 Total tickets in database:', allTicketsSnapshot.size);
      
      // Filter client-side for user tickets
      const userTickets = [];
      
      allTicketsSnapshot.forEach(doc => {
        const ticketData = { id: doc.id, ...doc.data() };
        
        // Check if ticket belongs to current user
        const belongsToUser = 
          ticketData.userId === currentUser.uid ||
          ticketData.userEmail === currentUser.email ||
          ticketData.email === currentUser.email;
        
        if (belongsToUser) {
          userTickets.push(ticketData);
          console.log('✅ Found user ticket:', {
            id: doc.id,
            ticketId: ticketData.ticketId,
            eventName: ticketData.eventName
          });
        }
      });
      
      // Sort by creation date (newest first) - client-side sorting
      userTickets.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      console.log('🎫 Final user tickets found:', userTickets.length);
      setTickets(userTickets);
      
    } catch (error) {
      console.error('❌ Error fetching tickets:', error);
      setError(error.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  // Add a new ticket to the context (when created)
  const addTicket = (newTicket) => {
    console.log('➕ Adding ticket to context:', newTicket);
    
    setTickets(prevTickets => {
      // Check if ticket already exists
      const exists = prevTickets.some(ticket => 
        ticket.id === newTicket.id || ticket.ticketId === newTicket.ticketId
      );
      
      if (exists) {
        console.log('🔄 Ticket already exists, updating');
        return prevTickets.map(ticket => 
          ticket.id === newTicket.id || ticket.ticketId === newTicket.ticketId 
            ? newTicket 
            : ticket
        );
      } else {
        console.log('🆕 Adding new ticket to context');
        const updatedTickets = [newTicket, ...prevTickets];
        console.log('📊 Updated tickets count:', updatedTickets.length);
        return updatedTickets;
      }
    });
  };

  // Delete ticket from context and Firestore
  const deleteTicket = async (ticketId) => {
    try {
      console.log('🗑️ Deleting ticket:', ticketId);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'tickets', ticketId));
      
      // Remove from local state
      setTickets(prevTickets => {
        const updatedTickets = prevTickets.filter(ticket => ticket.id !== ticketId);
        console.log('📊 Tickets after deletion:', updatedTickets.length);
        return updatedTickets;
      });
      
      console.log('✅ Ticket deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting ticket:', error);
      throw error;
    }
  };

  // Update ticket check-in status
  const updateTicketCheckin = async (ticketId, checkedIn = true) => {
    try {
      console.log('🔄 Updating ticket check-in:', ticketId, checkedIn);
      
      // Update in Firestore
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, {
        checkedIn: checkedIn,
        checkedInAt: checkedIn ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      // Update in local state
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketId
            ? { 
                ...ticket, 
                checkedIn: checkedIn,
                checkedInAt: checkedIn ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
              }
            : ticket
        )
      );

      console.log('✅ Ticket check-in updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating ticket check-in:', error);
      throw error;
    }
  };

  // Calculate ticket statistics
  const getTicketStats = () => {
    const totalTickets = tickets.length;
    const checkedInTickets = tickets.filter(ticket => ticket.checkedIn === true).length;
    
    // Calculate upcoming events (events in the future)
    const today = new Date().toISOString().split('T')[0];
    const upcomingEvents = tickets.filter(ticket => {
      if (!ticket.eventDate) return false;
      return ticket.eventDate >= today;
    }).length;

    return {
      totalTickets,
      checkedInTickets,
      upcomingEvents
    };
  };

  // Find ticket by ID or ticketId
  const findTicket = (ticketId) => {
    return tickets.find(ticket => 
      ticket.id === ticketId || 
      ticket.ticketId === ticketId
    );
  };

  // Clear tickets (for logout)
  const clearTickets = () => {
    console.log('🧹 Clearing tickets from context');
    setTickets([]);
    setError(null);
  };

  // Auto-fetch tickets when user changes
  useEffect(() => {
    if (currentUser) {
      console.log('👤 User detected in context, fetching tickets for:', currentUser.uid);
      getUserTickets(true); // Force refresh when user changes
    } else {
      console.log('👤 No user, clearing tickets');
      clearTickets();
    }
  }, [currentUser?.uid]); // Only depend on UID to avoid infinite loops

  const value = {
    tickets,
    loading,
    error,
    getUserTickets,
    addTicket,
    deleteTicket,
    updateTicketCheckin,
    getTicketStats,
    findTicket,
    clearTickets
  };

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
}