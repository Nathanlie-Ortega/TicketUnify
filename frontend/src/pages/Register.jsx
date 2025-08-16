// src/pages/Register.jsx - Updated with auto check-in support
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { validateEmail, validatePassword } from '../utils/validation';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if we're coming from ticket validation page
  const fromValidation = searchParams.get('from') === 'validation';
  const ticketId = searchParams.get('ticketId');
  const autoCheckIn = searchParams.get('autoCheckIn') === 'true';
  
  // Pre-fill email from ticket data if available
  useEffect(() => {
    if (fromValidation && ticketId) {
      // Try to get email from temporary ticket data
      const tempTicketData = localStorage.getItem(`temp-ticket-${ticketId}`);
      if (tempTicketData) {
        try {
          const tempTicket = JSON.parse(tempTicketData);
          if (tempTicket.email) {
            setFormData(prev => ({ ...prev, email: tempTicket.email }));
          }
        } catch (error) {
          console.warn('Failed to parse temporary ticket data');
        }
      }
    }
  }, [fromValidation, ticketId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      console.log('🔄 Starting signup process...', {
        fromValidation,
        autoCheckIn,
        ticketId
      });
      
      // Prepare signup options
      const signupOptions = {
        autoCheckIn: autoCheckIn && fromValidation // Only auto check-in if coming from validation
      };
      
      // Call the signup function from AuthContext with auto check-in option
      const result = await signup(formData.email, formData.password, formData.fullName, signupOptions);
      
      console.log('✅ Signup successful:', result);
      
      // Show appropriate success message based on context
      if (fromValidation && autoCheckIn) {
        toast.success('Account created and checked in successfully! Welcome to the event!');
      } else if (fromValidation) {
        toast.success('Account created successfully! Your ticket has been converted to permanent.');
      } else {
        toast.success('Account created successfully! Welcome to TicketUnify!');
      }
      
      // Navigate based on context
      if (fromValidation && ticketId) {
        // If coming from validation, redirect back to the ticket validation page
        navigate(`/validate/${ticketId}`, { replace: true });
      } else {
        // Normal flow - go to dashboard
        navigate('/dashboard', { replace: true });
      }
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      
      // Better error handling
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error?.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists. Try signing in instead.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please choose a stronger password.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection and try again.';
            break;
          default:
            errorMessage = `Registration failed: ${error.message || 'Unknown error'}`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      
      // If it's an "already exists" error, suggest going to login
      if (error?.code === 'auth/email-already-in-use') {
        setTimeout(() => {
          if (fromValidation) {
            toast('You can sign in to access your ticket', {
              icon: '💡',
              duration: 4000
            });
          } else {
            toast('You can sign in with your existing account', {
              icon: '💡',
              duration: 4000
            });
          }
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Determine page messaging based on context
  const getPageTitle = () => {
    if (fromValidation && autoCheckIn) {
      return 'Sign Up to Check In';
    } else if (fromValidation) {
      return 'Sign Up to Secure Your Ticket';
    }
    return 'Create Account';
  };

  const getPageSubtitle = () => {
    if (fromValidation && autoCheckIn) {
      return 'Create your account to complete check-in and confirm your entry';
    } else if (fromValidation) {
      return 'Create your account to convert your temporary ticket to permanent';
    }
    return 'Join TicketUnify to start creating professional tickets';
  };

  const getSubmitButtonText = () => {
    if (fromValidation && autoCheckIn) {
      return loading ? 'Creating Account & Checking In...' : 'Create Account & Check In';
    } else if (fromValidation) {
      return loading ? 'Creating Account & Securing Ticket...' : 'Create Account & Secure Ticket';
    }
    return loading ? 'Creating Account...' : 'Create Account';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 transition-colors">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{getPageTitle()}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {getPageSubtitle()}
          </p>
          
          {/* Special messaging for validation flow */}
          {fromValidation && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {autoCheckIn 
                  ? '🎉 After creating your account, you\'ll be automatically checked in!'
                  : '🔒 This will convert your temporary ticket to a permanent, secure ticket.'
                }
              </p>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
                errors.fullName 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-black dark:border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Enter your full name"
              required
            />
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
                errors.email 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-black dark:border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Enter your email"
              required
              disabled={fromValidation && formData.email} // Disable if pre-filled from ticket
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
            {fromValidation && formData.email && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email pre-filled from your ticket
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
                errors.password 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-black dark:border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Create a password"
              required
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
                errors.confirmPassword 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-black dark:border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Confirm your password"
              required
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            className="w-full"
            size="lg"
          >
            {getSubmitButtonText()}
          </Button>

          {/* Terms and Privacy */}
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By creating an account, you agree to our{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
            </p>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Already have an account?{' '}
              <Link 
                to={fromValidation 
                  ? `/login?from=validation&ticketId=${ticketId}&autoCheckIn=${autoCheckIn}` 
                  : "/login"
                } 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
              >
                Sign in
              </Link>
            </p>
            
            {fromValidation ? (
              <Link 
                to={`/validate/${ticketId}`} 
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                ← Back to ticket validation
              </Link>
            ) : (
              <Link 
                to="/" 
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                ← Back to home
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}