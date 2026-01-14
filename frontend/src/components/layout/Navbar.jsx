// src/components/layout/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, X, Ticket, User, LogOut, LayoutDashboard, Settings } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import SettingsModal from '../SettingsModal';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const getUserDisplayName = () => {
    if (userProfile?.fullName) return userProfile.fullName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Listen for profile picture updates from Firebase Auth and localStorage
  useEffect(() => {
    const checkForAccountProfileImage = () => {
      try {
        // FIRST: Check Firebase Auth for profile picture
        if (currentUser?.photoURL) {
          setProfileImage(currentUser.photoURL);
          localStorage.setItem('userProfileImage', currentUser.photoURL);
          return;
        }
        
        // SECOND: Check localStorage for account profile image (fallback)
        const accountImage = localStorage.getItem('userProfileImage');
        if (accountImage) {
          setProfileImage(accountImage);
          return;
        }
        
        // THIRD: Check pending account profile image (during signup process)
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

    checkForAccountProfileImage();
    
    let interval;
    if (currentUser) {
      interval = setInterval(checkForAccountProfileImage, 500);
    }
    
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

  useEffect(() => {
    const handleAccountProfileUpdate = (event) => {
      const { name, email, avatar } = event.detail || {};
      
      if (avatar && currentUser) {
        saveProfileImageToStorage(avatar);
      }
    };

    window.addEventListener('userProfileUpdated', handleAccountProfileUpdate);
    
    return () => {
      window.removeEventListener('userProfileUpdated', handleAccountProfileUpdate);
    };
  }, [currentUser]);

    return (
      <>
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* LEFT: Logo */}
              <Link to="/" className="flex items-center space-x-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Ticket className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  TicketUnify
                </span>
              </Link>

              {/* RIGHT: Navigation + Theme Toggle + User Menu */}
              <div className="hidden md:flex items-center space-x-6">
                {/* Navigation Links */}
                <Link
                  to="/"
                  className={`text-sm font-medium transition-colors ${
                    isActive('/') 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Home
                </Link>

                {currentUser && (
                  <>
                    <Link
                      to="/dashboard"
                      className={`text-sm font-medium transition-colors ${
                        isActive('/dashboard') 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/scanner"
                      className={`text-sm font-medium transition-colors ${
                        isActive('/scanner') 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      Scanner
                    </Link>
                    {userProfile?.role === 'admin' && (
                      <Link
                        to="/admin"
                        className={`text-sm font-medium transition-colors ${
                          isActive('/admin') 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                      >
                        Admin
                      </Link>
                    )}
                  </>
                )}

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Menu or Auth Buttons */}
                {currentUser ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden border-2 border-blue-500 dark:border-blue-800">
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
                      <span className="text-sm font-medium">
                        {getUserDisplayName()}
                      </span>
                    </button>

                      {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                          <div className="px-4 py-3 border-b-2 border-gray-400 dark:border-gray-600">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={currentUser.email}>
                              {currentUser.email}
                            </p>
                          </div>
                        <div className="py-1">
                          <Link
                            to="/dashboard"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <User size={16} className="mr-2" />
                            Dashboard
                          </Link>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowSettingsModal(true);
                            }}
                            className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Settings size={16} className="mr-2" />
                            Settings
                          </button>
                          <button
                            onClick={handleLogout}
                            className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                          >
                            <LogOut size={16} className="mr-2" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      to="/login"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden flex items-center space-x-3">
                <ThemeToggle />
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
                >
                  {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
        
        {/* Settings Modal */}
        <SettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
        />
      </>
    );
}