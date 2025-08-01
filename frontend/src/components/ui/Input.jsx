// src/components/ui/Input.jsx
import React from 'react';

const Input = React.forwardRef(({ 
  className = '', 
  type = 'text', 
  error,
  label,
  helperText,
  ...props 
}, ref) => {
  const inputClasses = [
    'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
    error 
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
      : 'border-gray-800 dark:border-gray-600 focus:border-blue-500',
    'disabled:bg-gray-50 disabled:cursor-not-allowed',
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={inputClasses}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;