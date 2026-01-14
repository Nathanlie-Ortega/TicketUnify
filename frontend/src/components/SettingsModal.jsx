import React, { useState } from 'react';
import { X, User, Lock, Mail, Trash2, Upload, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

export default function SettingsModal({ isOpen, onClose }) {
  const { currentUser, updateUserPassword, updateUserEmail, deleteUserAccount } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile Picture states
  const [profileImage, setProfileImage] = useState(currentUser?.photoURL || localStorage.getItem('userProfileImage') || null);
  const [uploadingImage, setUploadingImage] = useState(false);

    const [fullName, setFullName] = useState(currentUser?.displayName || '');
    const [editingName, setEditingName] = useState(false);
  
  // Password states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Email states
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  
// Delete account states
const [deleteConfirm, setDeleteConfirm] = useState('');
const [showDeleteWarning, setShowDeleteWarning] = useState(false);

// Reset all state when modal closes
React.useEffect(() => {
  if (!isOpen) {
    setActiveTab('profile');
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setNewEmail('');
    setEmailPassword('');
    setDeleteConfirm('');
    setShowDeleteWarning(false);
    setEditingName(false);
    setLoading(false);
  }
}, [isOpen]);

// Update profile image and name when user changes
React.useEffect(() => {
  if (currentUser) {
    const storedImage = localStorage.getItem('userProfileImage');
    setProfileImage(currentUser?.photoURL || storedImage || null);
    setFullName(currentUser?.displayName || '');
  }
}, [currentUser?.uid]);

if (!isOpen) return null;

const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
        const base64 = reader.result;
        
        // Store in localStorage
        localStorage.setItem('userProfileImage', base64);
        setProfileImage(base64);
        
        toast.success('Profile picture updated!');
        setUploadingImage(false);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Failed to upload image');
        setUploadingImage(false);
    }
    };

const handleRemoveProfilePicture = () => {
  localStorage.removeItem('userProfileImage');
  setProfileImage(null);
  toast.success('Profile picture removed!');
};

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setLoading(true);
    try {
      await updateUserPassword(currentUser.email);
      toast.success('Password reset email sent! Check your inbox.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      await updateUserEmail(newEmail, emailPassword);
      toast.success('Email updated successfully! Please check your inbox or spam to verify your authentication.');
      setNewEmail('');
      setEmailPassword('');
      onClose();
    } catch (error) {
      console.error('Email change error:', error);
      toast.error(error.message || 'Failed to change email');
    } finally {
      setLoading(false);
    }
  };

    const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
        toast.error('Please type DELETE to confirm');
        return;
    }

    if (!emailPassword) {
        toast.error('Please enter your password');
        return;
    }

    setLoading(true);
    try {
        await deleteUserAccount(emailPassword);
        toast.success('Account deleted successfully');
        onClose();
    } catch (error) {
        console.error('Delete account error:', error);
        toast.error(error.message || 'Failed to delete account');
    } finally {
        setLoading(false);
    }
    };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-4 py-3 font-medium ${
                activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            >
            <User size={18} className="inline mr-2" />
            My Profile
            </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 px-4 py-3 font-medium ${
              activeTab === 'password'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Lock size={18} className="inline mr-2" />
            Password
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 px-4 py-3 font-medium ${
              activeTab === 'email'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Mail size={18} className="inline mr-2" />
            Email
          </button>
          <button
            onClick={() => setActiveTab('delete')}
            className={`flex-1 px-4 py-3 font-medium ${
              activeTab === 'delete'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Trash2 size={18} className="inline mr-2" />
            Delete
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
            {/* My Profile Tab */}
            {activeTab === 'profile' && (
            <div className="space-y-6">
                {/* Profile Picture Section */}
                <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Picture</h3>
                <div className="flex flex-col items-center">
                    {profileImage ? (
                    <img
                        src={profileImage}
                        alt="Profile"
                        className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 mb-4"
                    />
                    ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                        <User size={48} className="text-gray-400" />
                    </div>
                    )}
                    
                    <div className="flex gap-2">
                    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
                        <Upload size={16} className="inline mr-2" />
                        {profileImage ? 'Change' : 'Upload'}
                        <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                        />
                    </label>
                    
                    {profileImage && (
                        <button
                        onClick={handleRemoveProfilePicture}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                        Remove
                        </button>
                    )}
                    </div>
                </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {/* Full Name Section */}
                <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Full Name</h3>
                <div className="space-y-3">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Your Name
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={!editingName}
                        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white ${
                        editingName 
                            ? 'bg-white dark:bg-gray-700' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}
                        placeholder="Enter your full name"
                    />
                    </div>

                    <div className="flex gap-2">
                    {!editingName ? (
                        <button
                        onClick={() => setEditingName(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                        Edit Name
                        </button>
                    ) : (
                        <>
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    // Update display name in Firebase
                                    await updateProfile(currentUser, { displayName: fullName });
                                    
                                    // Update in Firestore if exists
                                    try {
                                    const userDocRef = doc(db, 'users', currentUser.uid);
                                    await updateDoc(userDocRef, { fullName: fullName });
                                    } catch (err) {
                                    console.log('No Firestore user doc to update');
                                    }
                                    
                                    toast.success('Name updated successfully!');
                                    setEditingName(false);
                                } catch (error) {
                                    console.error('Name update error:', error);
                                    toast.error('Failed to update name');
                                } finally {
                                    setLoading(false);
                                }
                                }}

                            disabled={loading || !fullName.trim()}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={() => {
                            setFullName(currentUser?.displayName || '');
                            setEditingName(false);
                            }}
                            className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                        </>
                    )}
                    </div>
                </div>
                </div>
            </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    Click "Reset Password" to receive a password reset link in your email inbox.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    <span><strong>Note:</strong> The email might go to your spam/junk folder. Please check there if you don't see it in your inbox.</span>
                </p>
                </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleChangeEmail} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Email
                </label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter new email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password (for verification)
                </label>
                <input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter current password"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading || !newEmail || !emailPassword}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Email'}
              </button>
            </form>
          )}




        {/* Delete Account Tab */}
        {activeTab === 'delete' && (
        <div className="space-y-4">
            {!showDeleteWarning ? (
            <button
                onClick={() => setShowDeleteWarning(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
                Delete My Account
            </button>
            ) : (
            <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-2 border-red-600">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                    <h3 className="font-bold text-red-900 dark:text-red-100 mb-2">
                        Warning: This action cannot be undone!
                    </h3>
                    <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                        <li>Your account will be permanently deleted</li>
                        <li>All your tickets will be deleted</li>
                    </ul>
                    </div>
                </div>
                </div>
                
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enter your password to confirm
                </label>
                <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your password"
                />
                </div>
                
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Type DELETE"
                />
                </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDeleteWarning(false);
                        setDeleteConfirm('');
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>

                    <button
                    onClick={handleDeleteAccount}
                    disabled={loading || deleteConfirm !== 'DELETE' || !emailPassword}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                    {loading ? 'Deleting...' : 'Delete Forever'}
                    </button>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}