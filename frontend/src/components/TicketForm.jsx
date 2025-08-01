// src/components/TicketForm.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ImageUpload from './ImageUpload';

const ticketSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  eventName: z.string().min(1, 'Event name is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  eventLocation: z.string().min(1, 'Event location is required'),
  ticketType: z.string().min(1, 'Ticket type is required')
});

export default function TicketForm({ onSubmit, initialData = {} }) {
  const [avatarFile, setAvatarFile] = useState(null);
  
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
      eventLocation: initialData.eventLocation || 'Dallas, TX',
      ticketType: initialData.ticketType || 'Standard'
    }
  });

  // Watch form values for real-time preview
  const watchedValues = watch();

  // Call onSubmit whenever form values change for real-time preview
  React.useEffect(() => {
    if (watchedValues.fullName || watchedValues.email) {
      onSubmit(watchedValues, avatarFile);
    }
  }, [watchedValues, avatarFile, onSubmit]);

  const handleFormSubmit = (data) => {
    onSubmit(data, avatarFile);
  };

  const handleAvatarChange = (file) => {
    setAvatarFile(file);
  };

  return (
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.fullName ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.email ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
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
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.eventName ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.eventDate ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
            }`}
          />
          {errors.eventDate && (
            <p className="mt-1 text-sm text-red-600">{errors.eventDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="eventLocation" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Event Location *
          </label>
          <input
            type="text"
            id="eventLocation"
            {...register('eventLocation')}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.eventLocation ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
            }`}
            placeholder="City, State or Venue"
          />
          {errors.eventLocation && (
            <p className="mt-1 text-sm text-red-600">{errors.eventLocation.message}</p>
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
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.ticketType ? 'border-red-500' : 'border-gray-800 dark:border-gray-300'
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
        {isSubmitting ? 'Generating Ticket...' : 'Generate Ticket'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        * Required fields. Your information is secure and will only be used for ticket generation.
      </p>
    </form>
  );
}