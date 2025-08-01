// src/utils/validation.js
import { z } from 'zod';

export const ticketSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  eventName: z.string().min(1, 'Event name is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  eventLocation: z.string().min(1, 'Event location is required'),
  ticketType: z.string().min(1, 'Ticket type is required')
});

export const userSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validateTicketId = (ticketId) => {
  return ticketId && ticketId.length > 5;
};