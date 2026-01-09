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
  eventTime: z.string().min(1, 'Event time is required'),
  location: z.string().min(1, 'Event location is required'),
  ticketType: z.string().min(1, 'Ticket type is required')
});

export default function TicketForm({ onPreviewUpdate, onSubmitSuccess, initialData = {} }) {

  //Helper function to get minimum date (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Function to validate if event datetime is in the future
    const isEventTimeValid = (eventDate, eventTime) => {
      if (!eventDate || !eventTime) return true;
      
      const now = new Date();
      
      // Create date objects for comparison
      const selectedDate = new Date(eventDate + 'T00:00:00');
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // If date is in the past, invalid
      if (selectedDate < todayDate) {
        console.log(' Date is in the past');
        return false;
      }
      
      // If date is in the future, any time is valid
      if (selectedDate > todayDate) {
        console.log(' Future date - time is valid');
        return true;
      }
      
      // If date is today, check if time is in the future
      const [eventHours, eventMinutes] = eventTime.split(':').map(Number);
      const selectedDateTime = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate(), 
        eventHours, 
        eventMinutes
      );
      
      // Must be at least 1 minute in the future
      const minimumTime = new Date(now.getTime() + 60000); // Current time + 1 minute
      
      const isValid = selectedDateTime >= minimumTime;
      
      console.log(' Time validation:', {
        current: now.toLocaleTimeString(),
        selected: selectedDateTime.toLocaleTimeString(),
        minimum: minimumTime.toLocaleTimeString(),
        isValid: isValid
      });
      
      return isValid;
    };

  // Get custom validation message for time field
  const getTimeValidationMessage = (eventDate, eventTime) => {
    const today = new Date().toISOString().split('T')[0];
    
    if (eventDate === today) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      return `Value must be ${displayHour}:${displayMinutes} ${ampm} or later.`;
    }
    
    return '';
  };


  const [avatarFile, setAvatarFile] = useState(null);
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [generatedTicketId, setGeneratedTicketId] = useState(null);
  const timeInputRef = React.useRef(null);
  
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
      eventTime: initialData.eventTime || (() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1);
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      })(),
      location: initialData.location || 'Dallas, TX',
      ticketType: initialData.ticketType || 'Standard'
    }
  });

  // Watch form values for real-time preview
  const watchedValues = watch();


  // Set custom validation message on the time input
  React.useEffect(() => {
    if (timeInputRef.current && watchedValues.eventDate && watchedValues.eventTime) {
      const isValid = isEventTimeValid(watchedValues.eventDate, watchedValues.eventTime);
      const validationMessage = isValid ? '' : getTimeValidationMessage(watchedValues.eventDate, watchedValues.eventTime);
      
      timeInputRef.current.setCustomValidity(validationMessage);
      // DON'T call reportValidity() here - it causes infinite loops
    }
  }, [watchedValues.eventDate, watchedValues.eventTime]);



  // Real-time preview update (NO backend call)
  React.useEffect(() => {
    if (onPreviewUpdate && typeof onPreviewUpdate === 'function' && !generatedTicketId) {
      onPreviewUpdate(watchedValues, avatarFile);
    }
  }, [watchedValues, avatarFile, onPreviewUpdate, generatedTicketId]);

  // Form submission (WITH backend call)
  const handleFormSubmit = async (data) => {
    try {
      setSubmitStatus({ type: '', message: '' });
      


  // VALIDATE EVENT TIME BEFORE SUBMITTING (with 30-second grace for submission processing)
  console.log(' Validating before submission...');

  // For today's date, allow if time was valid when form was filled (30 sec grace)
  const now = new Date();
  const selectedDate = new Date(data.eventDate + 'T00:00:00');
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (selectedDate.getTime() === todayDate.getTime()) {
    // It's today - check time with 30-second grace period
    const [eventHours, eventMinutes] = data.eventTime.split(':').map(Number);
    const selectedDateTime = new Date(
      now.getFullYear(), 
      now.getMonth(), 
      now.getDate(), 
      eventHours, 
      eventMinutes
    );
    
    // Allow submission if event time is within 30 seconds in the past (form filling delay)
    const gracePeriod = new Date(now.getTime() - 30000); // 30 seconds ago
    
    if (selectedDateTime < gracePeriod) {
      console.log(' Validation failed - time is in the past');
      alert('Event time must be in the future. Please select a later time.');
      return;
    }
  }

  console.log(' Validation passed - proceeding with submission');


      
      console.log(' Validation passed - proceeding with submission');
      console.log(' Form submitted with data:', data);
      console.log(' Ticket type:', data.ticketType);
      
      if (data.ticketType === 'Premium') {
        console.log(' Premium ticket - passing to Home for payment...');
        
        if (onSubmitSuccess && typeof onSubmitSuccess === 'function') {
          onSubmitSuccess(data, avatarFile);
        }
        return;
      }
      
      console.log(' Standard ticket - creating directly...');
      const response = await api.createTicket(data);
      
      if (response.success) {
        let ticketId = response.ticket?.ticketId || response.ticket?.id || response.ticketId || response.id;
        
        console.log(' Extracted ticket ID:', ticketId);
        
        setGeneratedTicketId(ticketId);
        
        const finalTicketData = {
          fullName: data.fullName,
          email: data.email,
          eventName: data.eventName,
          eventDate: data.eventDate,
          eventTime: data.eventTime,
          location: data.location,
          ticketType: data.ticketType,
          ticketId: ticketId,
          id: ticketId,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        console.log(' Final ticket data being sent to Home:', finalTicketData);
        
        if (onSubmitSuccess && typeof onSubmitSuccess === 'function') {
          onSubmitSuccess(finalTicketData, avatarFile);
        }
      } else {
        throw new Error(response.message || 'Failed to create ticket');
      }
    } catch (error) {
      console.error(' Ticket creation failed:', error);
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

        {/* Event Date and Event Time - Same Row */}
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
            <label htmlFor="eventTime" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Event Time *
            </label>
            <input
              type="time"
              id="eventTime"
              ref={timeInputRef}
              {...register('eventTime')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.eventTime 
                  ? 'border-red-500' 
                  : 'border-black dark:border-gray-600'
              }`}
            />
            {errors.eventTime && (
              <p className="mt-1 text-sm text-red-600">{errors.eventTime.message}</p>
            )}
          </div>
        </div>

        {/* Event Location - Its Own Row */}
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
            <option value="Premium">Premium - $4.99</option>
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