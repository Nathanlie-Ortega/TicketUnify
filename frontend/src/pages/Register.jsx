// src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      console.log('🔄 Starting signup process...');
      
      // Call the signup function from AuthContext
      const result = await signup(formData.email, formData.password, formData.fullName);
      
      console.log('✅ Signup successful:', result);
      
      // Show success message
      toast.success('Account created successfully! Welcome to TicketUnify!');
      
      // Navigate to dashboard after successful registration
      navigate('/dashboard', { replace: true });
      
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
          toast('You can sign in with your existing account', {
            icon: '💡',
            duration: 4000
          });
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 transition-colors">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create Account</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Join TicketUnify to start creating professional tickets
          </p>
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
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
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
            {loading ? 'Creating Account...' : 'Create Account'}
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
              <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium">
                Sign in
              </Link>
            </p>
            <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
              ← Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}