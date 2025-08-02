// src/contexts/TicketContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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
  const { currentUser } = useAuth();

  // Get tickets for the current user
  const getUserTickets = useCallback(async () => {
    if (!currentUser) {
      console.log('❌ No current user - cannot fetch tickets');
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Fetching tickets for user:', currentUser.uid);
      console.log('🔄 User email:', currentUser.email);
      
      // Query tickets where userId matches current user OR email matches current user
      const ticketsRef = collection(db, 'tickets');
      const q = query(
        ticketsRef,
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      
      const userTickets = [];
      querySnapshot.forEach((doc) => {
        const ticketData = doc.data();
        userTickets.push({
          id: doc.id,
          ...ticketData
        });
        console.log('📋 Found ticket:', doc.id, ticketData);
      });
      
      console.log('✅ Fetched', userTickets.length, 'tickets for user');
      
      // If no tickets found with userId, try to find by email
      if (userTickets.length === 0 && currentUser.email) {
        console.log('🔄 No tickets with userId, searching by email...');
        const emailQuery = query(
          ticketsRef,
          where('email', '==', currentUser.email)
        );
        
        const emailSnapshot = await getDocs(emailQuery);
        console.log('📧 Found', emailSnapshot.size, 'tickets by email');
        
        emailSnapshot.forEach((doc) => {
          const ticketData = doc.data();
          userTickets.push({
            id: doc.id,
            ...ticketData
          });
          console.log('📋 Found ticket by email:', doc.id, ticketData);
        });
      }
      
      setTickets(userTickets);
      
    } catch (error) {
      console.error('❌ Error fetching user tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Get a specific ticket by ID
  const getTicket = async (ticketId) => {
    try {
      console.log('🔄 Getting ticket:', ticketId);
      
      // For now, just find in current tickets array
      const ticket = tickets.find(t => t.id === ticketId || t.ticketId === ticketId);
      
      if (ticket) {
        console.log('✅ Found ticket:', ticket);
        return ticket;
      } else {
        console.log('❌ Ticket not found');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting ticket:', error);
      return null;
    }
  };

  // Check in a ticket
  const checkInTicket = async (ticketId) => {
    try {
      console.log('🔄 Checking in ticket:', ticketId);
      
      // Find the ticket document in Firebase
      const ticketsRef = collection(db, 'tickets');
      const q = query(
        ticketsRef,
        where('ticketId', '==', ticketId),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Ticket not found or not owned by user');
      }
      
      // Update the first matching ticket
      const ticketDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        checkedIn: true,
        checkedInAt: new Date().toISOString()
      });
      
      // Update local state
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.ticketId === ticketId 
            ? { ...ticket, checkedIn: true, checkedInAt: new Date().toISOString() }
            : ticket
        )
      );
      
      console.log('✅ Ticket checked in successfully');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error checking in ticket:', error);
      throw error;
    }
  };

  // Add a new ticket to the context (when created)
  const addTicket = (newTicket) => {
    console.log('➕ Adding new ticket to context:', newTicket);
    setTickets(prevTickets => [...prevTickets, newTicket]);
  };

  // Get tickets statistics
  const getTicketStats = () => {
    const totalTickets = tickets.length;
    const checkedInTickets = tickets.filter(t => t.checkedIn).length;
    const upcomingEvents = tickets.filter(t => {
      if (!t.eventDate) return false;
      const eventDate = new Date(t.eventDate);
      const today = new Date();
      return eventDate > today;
    }).length;

    return {
      totalTickets,
      checkedInTickets,
      upcomingEvents
    };
  };

  const value = {
    tickets,
    loading,
    getUserTickets,
    getTicket,
    checkInTicket,
    addTicket,
    getTicketStats
  };

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
}