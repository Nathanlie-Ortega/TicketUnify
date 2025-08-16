// src/components/layout/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Menu, X, Ticket, User, LogOut, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const { currentUser, userProfile, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Get user display name with fallback priority
  const getUserDisplayName = () => {
    // Priority: userProfile.fullName > currentUser.displayName > email username
    if (userProfile?.fullName) {
      return userProfile.fullName.split(' ')[0]; // First name only
    }
    if (currentUser?.displayName) {
      return currentUser.displayName.split(' ')[0]; // First name only
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0]; // Email username
    }
    return 'User';
  };

  // Listen for profile picture updates from localStorage (ACCOUNT profile only)
  useEffect(() => {
    const checkForAccountProfileImage = () => {
      try {
        // Only check for account profile image (not ticket-specific images)
        const accountImage = localStorage.getItem('userProfileImage');
        if (accountImage) {
          setProfileImage(accountImage);
          return;
        }
        
        // Check pending account profile image (during signup process)
        const pendingImage = localStorage.getItem('pendingUserProfileImage');
        if (pendingImage) {
          setProfileImage(pendingImage);
          return;
        }
        
        // No account profile image found
        setProfileImage(null);
      } catch (error) {
        console.log('Error checking for account profile image:', error);
        setProfileImage(null);
      }
    };

    // Check immediately when component mounts or user changes
    checkForAccountProfileImage();
    
    // Set up an interval to check for updates every 500ms when user is logged in
    let interval;
    if (currentUser) {
      interval = setInterval(checkForAccountProfileImage, 500);
    }
    
    // Listen for storage events (when localStorage changes in other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'userProfileImage' || e.key === 'pendingUserProfileImage') {
        checkForAccountProfileImage();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser]);

  // Save profile image to localStorage when user signs up
  const saveProfileImageToStorage = (imageUrl) => {
    try {
      if (imageUrl && currentUser) {
        localStorage.setItem('userProfileImage', imageUrl);
        setProfileImage(imageUrl);
      }
    } catch (error) {
      console.log('Failed to save profile image:', error);
    }
  };

  // Listen for custom events (when user signs up - ACCOUNT profile updates only)
  useEffect(() => {
    const handleAccountProfileUpdate = (event) => {
      const { name, email, avatar } = event.detail || {};
      
      // Only update account profile picture, not ticket-specific ones
      if (avatar && currentUser) {
        saveProfileImageToStorage(avatar);
      }
      
      // Force re-render of display name
      if (name && currentUser) {
        // The name will be picked up by getUserDisplayName() automatically
        // through userProfile or currentUser.displayName
      }
    };

    window.addEventListener('userProfileUpdated', handleAccountProfileUpdate);
    
    return () => {
      window.removeEventListener('userProfileUpdated', handleAccountProfileUpdate);
    };
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      // Clear account profile image on logout (not ticket-specific images)
      localStorage.removeItem('userProfileImage');
      localStorage.removeItem('pendingUserProfileImage');
      sessionStorage.removeItem('currentTicketAvatar');
      setProfileImage(null);
      
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-lg sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                TicketUnify
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Home
            </Link>

            {currentUser && (
              <>
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/dashboard') 
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/scanner"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/scanner') 
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Scanner
                </Link>
                {userProfile?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/admin') 
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User Menu or Auth Buttons */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
                >
                  {/* Dynamic Profile Picture */}
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden border-2 border-blue-200 dark:border-blue-800">
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        onError={() => setProfileImage(null)} // Fallback if image fails to load
                      />
                    ) : (
                      <User size={18} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {getUserDisplayName()}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border dark:border-gray-700">
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                      {currentUser.email}
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User size={16} className="inline mr-2" />
                      Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <LogOut size={16} className="inline mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Dark Mode Toggle for Mobile */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:text-blue-600 transition-colors"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <Link
                to="/"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive('/') 
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                onClick={() => setIsOpen(false)}
              >
                Home
              </Link>

              {currentUser ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/dashboard') 
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/scanner"
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/scanner') 
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Scanner
                  </Link>
                  {userProfile?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        isActive('/admin') 
                          ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <div className="flex items-center px-3 py-2">
                      {/* Mobile Profile Picture */}
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden border-2 border-blue-200 dark:border-blue-800 mr-3">
                        {profileImage ? (
                          <img 
                            src={profileImage} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            onError={() => setProfileImage(null)}
                          />
                        ) : (
                          <User size={18} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {getUserDisplayName()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {currentUser.email}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block px-3 py-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </nav>
  );
}