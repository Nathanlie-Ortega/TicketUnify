import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ImageUpload from './ImageUpload';
import { api } from '../utils/api';

// Popular US Cities with States
const US_CITIES = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX',
  'San Jose, CA',
  'Austin, TX',
  'Jacksonville, FL',
  'Fort Worth, TX',
  'Columbus, OH',
  'Charlotte, NC',
  'San Francisco, CA',
  'Indianapolis, IN',
  'Seattle, WA',
  'Denver, CO',
  'Washington, DC',
  'Boston, MA',
  'El Paso, TX',
  'Nashville, TN',
  'Detroit, MI',
  'Oklahoma City, OK',
  'Portland, OR',
  'Las Vegas, NV',
  'Memphis, TN',
  'Louisville, KY',
  'Baltimore, MD',
  'Milwaukee, WI',
  'Albuquerque, NM',
  'Tucson, AZ',
  'Fresno, CA',
  'Sacramento, CA',
  'Kansas City, MO',
  'Mesa, AZ',
  'Atlanta, GA',
  'Omaha, NE',
  'Colorado Springs, CO',
  'Raleigh, NC',
  'Miami, FL',
  'Virginia Beach, VA',
  'Oakland, CA',
  'Minneapolis, MN',
  'Tulsa, OK',
  'Arlington, TX',
  'Tampa, FL',
  'New Orleans, LA',
  'Wichita, KS'
];

const ticketSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  eventName: z.string().min(1, 'Event name is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  location: z.string().min(1, 'Event location is required'),
  ticketType: z.string().min(1, 'Ticket type is required')
});

export default function TicketForm({ onPreviewUpdate, onSubmitSuccess, initialData = {} }) {
  const [avatarFile, setAvatarFile] = useState(null);
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [generatedTicketId, setGeneratedTicketId] = useState(null); // Track the ticket ID
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      fullName: initialData.fullName || '',
      email: initialData.email || '',
      eventName: initialData.eventName || '',
      eventDate: initialData.eventDate || new Date().toISOString().split('T')[0],
      location: initialData.location || 'Dallas, TX',
      ticketType: initialData.ticketType || 'Standard'
    }
  });

  // Watch form values for real-time preview
  const watchedValues = watch();

  // Real-time preview update (NO backend call)
  React.useEffect(() => {
    // ONLY update preview if we haven't submitted successfully yet
    if (onPreviewUpdate && typeof onPreviewUpdate === 'function' && !generatedTicketId) {
      onPreviewUpdate(watchedValues, avatarFile);
    }
  }, [watchedValues, avatarFile, onPreviewUpdate, generatedTicketId]);

  // Form submission (WITH backend call)
  const handleFormSubmit = async (data) => {
    try {
      setSubmitStatus({ type: '', message: '' });
      
      console.log('🎫 Submitting ticket data:', data);
      
      // Call backend API
      const response = await api.createTicket(data);
      
      if (response.success) {
        // Extract ticket ID from response - try EVERY possible location
        let ticketId = null;
        
        // Try all possible locations for the ticket ID
        if (response.ticket?.ticketId) {
          ticketId = response.ticket.ticketId;
        } else if (response.ticket?.id) {
          ticketId = response.ticket.id;
        } else if (response.ticketId) {
          ticketId = response.ticketId;
        } else if (response.id) {
          ticketId = response.id;
        }
        
        console.log('🎫 Extracted ticket ID:', ticketId);
        console.log('🎫 Full response:', response);
        
        setGeneratedTicketId(ticketId);
        
        
        // Create the final ticket data with GUARANTEED ticket ID
        const finalTicketData = {
          fullName: data.fullName,
          email: data.email,
          eventName: data.eventName,
          eventDate: data.eventDate,
          location: data.location,
          ticketType: data.ticketType,
          ticketId: ticketId, // FORCE the ticket ID here
          id: ticketId, // Also set as id
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        console.log('Final ticket data being sent to Home:', finalTicketData);
        
        // Call success callback
        if (onSubmitSuccess && typeof onSubmitSuccess === 'function') {
          onSubmitSuccess(finalTicketData, avatarFile);
        }
      } else {
        throw new Error(response.message || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Ticket creation failed:', error);
      setSubmitStatus({ 
        type: 'error', 
        message: `Failed to create ticket: ${error.message}` 
      });
    }
  };

  const handleAvatarChange = (file) => {
    setAvatarFile(file);
  };

  return (
    <div className="space-y-6">

      {/* Status Messages */}
      {submitStatus.message && (
        <div className={`p-4 rounded-lg ${
          submitStatus.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="whitespace-pre-line">{submitStatus.message}</div>
          {generatedTicketId && (
            <div className="mt-2 font-mono text-sm">
              <strong>Ticket ID:</strong> {generatedTicketId}<br/>
              <strong>Status:</strong> active
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Profile Picture (Optional)
          </label>
          <ImageUpload
            onImageChange={handleAvatarChange}
            currentImage={avatarFile}
          />
        </div>

        {/* Personal Information */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Full Name *
            </label>
            <input
              type="text"
              id="fullName"
              {...register('fullName')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.fullName 
                  ? 'border-red-500' 
                  : 'border-black dark:border-gray-600'
              }`}
              placeholder="Enter your full name"
            />
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              {...register('email')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.email 
                  ? 'border-red-500' 
                  : 'border-black dark:border-gray-600'
              }`}
              placeholder="Enter your email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
        </div>

        {/* Event Information */}
        <div>
          <label htmlFor="eventName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Event Name *
          </label>
          <input
            type="text"
            id="eventName"
            {...register('eventName')}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.eventName 
                ? 'border-red-500' 
                : 'border-black dark:border-gray-600'
            }`}
            placeholder="Conference or event name"
          />
          {errors.eventName && (
            <p className="mt-1 text-sm text-red-600">{errors.eventName.message}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="eventDate" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Event Date *
            </label>
            <input
              type="date"
              id="eventDate"
              {...register('eventDate')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.eventDate 
                  ? 'border-red-500' 
                  : 'border-black dark:border-gray-600'
              }`}
            />
            {errors.eventDate && (
              <p className="mt-1 text-sm text-red-600">{errors.eventDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Event Location *
            </label>
            <select
              id="location"
              {...register('location')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.location 
                  ? 'border-red-500' 
                  : 'border-black dark:border-gray-600'
              }`}
            >
              <option value="">Select a city</option>
              {US_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>
        </div>

        {/* Ticket Type */}
        <div>
          <label htmlFor="ticketType" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Ticket Type *
          </label>
          <select
            id="ticketType"
            {...register('ticketType')}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.ticketType 
                ? 'border-red-500' 
                : 'border-black dark:border-gray-600'
            }`}
          >
            <option value="Standard">Standard - Free</option>
            <option value="Premium">Premium - $49</option>
            <option value="VIP">VIP - $99</option>
          </select>
          {errors.ticketType && (
            <p className="mt-1 text-sm text-red-600">{errors.ticketType.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating Ticket...' : ' Generate & Save Ticket'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          * Required fields. Your ticket will be saved to the database and emailed to you.
        </p>
      </form>
    </div>
  );
}