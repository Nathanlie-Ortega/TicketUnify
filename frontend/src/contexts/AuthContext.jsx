// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updateEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Link anonymous tickets to user account
  async function linkAnonymousTickets(userEmail, userId) {
    try {
      console.log(' Linking anonymous tickets for:', userEmail);
      
      // Find tickets with matching email that are anonymous
      const ticketsRef = collection(db, 'tickets');
      const q = query(
        ticketsRef,
        where('email', '==', userEmail),
        where('userId', '==', 'anonymous')
      );
      
      const querySnapshot = await getDocs(q);
      
      console.log('Found', querySnapshot.size, 'anonymous tickets to link');
      
      // Update each anonymous ticket to link to user
      const updatePromises = querySnapshot.docs.map(async (docSnapshot) => {
        const ticketId = docSnapshot.id;
        console.log(' Linking ticket:', ticketId);
        
        return updateDoc(doc(db, 'tickets', ticketId), {
          userId: userId,
          linkedAt: new Date().toISOString(),
          status: 'active' // Ensure ticket is active
        });
      });
      
      await Promise.all(updatePromises);
      console.log(' Successfully linked', querySnapshot.size, 'tickets to user account');
      
      return querySnapshot.size;
    } catch (error) {
      console.error(' Error linking anonymous tickets:', error);
      return 0;
    }
  }

  // Sign up function
  async function signup(email, password, fullName) {
    try {
      console.log(' AuthContext: Starting signup...');
      
      // Step 1: Create Firebase Auth user
      console.log(' Creating Firebase Auth user...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log(' Firebase Auth user created:', user.uid);

      // Step 2: Update profile with display name
      console.log(' Updating display name...');

      await updateProfile(user, { 
        displayName: fullName
      });

      console.log(' Profile updated');

      // Optional: Store avatar in localStorage for Navbar display
      try {
        const pendingData = sessionStorage.getItem('pendingTicketData');
        if (pendingData) {
          const parsed = JSON.parse(pendingData);
          if (parsed.avatarFile) {
            console.log(' Storing profile picture locally...');
            localStorage.setItem('userProfileImage', parsed.avatarFile);
            console.log(' Profile picture stored in localStorage');
          }
        }
      } catch (avatarError) {
        console.warn(' Could not store profile picture:', avatarError);
      }

      // Step 3: Link any anonymous tickets with this email
      const linkedTicketsCount = await linkAnonymousTickets(email, user.uid);
      
      // Step 4: Create user profile in Firestore
      try {
        console.log(' Creating user document in Firestore...');
        
        const userProfile = {
          uid: user.uid,
          email: user.email,
          fullName: fullName,
          role: 'user',
          createdAt: new Date().toISOString(),
          ticketsGenerated: linkedTicketsCount,
          emailVerified: user.emailVerified,
          lastLoginAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', user.uid), userProfile);
        console.log(' User document created in Firestore');
        
      } catch (firestoreError) {
        console.warn(' Firestore user creation failed:', firestoreError);
      }
      
      sessionStorage.setItem('isNewUser', 'true');

      console.log(` Signup completed successfully! Linked ${linkedTicketsCount} existing tickets.`);
      return userCredential;
      
    } catch (error) {
      console.error(' Signup failed:', error);
      
      if (error.code && error.code.startsWith('auth/')) {
        throw error;
      } else {
        throw new Error('Account created but profile setup incomplete. You can still sign in.');
      }
    }
  }

  // Sign in function
  async function signin(email, password) {
    try {
      console.log(' AuthContext: Starting signin...');
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log(' Signin successful');
      return result;
    } catch (error) {
      console.error(' Signin failed:', error);
      throw error;
    }
  }

  // Sign out function
  function logout() {
    console.log(' AuthContext: Signing out...');
    setUserProfile(null);
    return signOut(auth);
  }

  // Get user profile from Firestore
  async function fetchUserProfile(uid) {
    try {
      console.log(' Fetching user profile for:', uid);
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const profile = userDoc.data();
        console.log(' User profile loaded:', profile);
        setUserProfile(profile);
        return profile;
      } else {
        console.warn(' User profile not found in Firestore');
        setUserProfile(null);
        return null;
      }
    } catch (error) {
      console.error(' Error fetching user profile:', error);
      setUserProfile(null);
      return null;
    }
  }

  // Send password reset email
  const updateUserPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log(' Password reset email sent');
    } catch (error) {
      console.error(' Password reset error:', error);
      throw error;
    }
  };

// Update user email - Send verification to new email
  const updateUserEmail = async (newEmail, password) => {
    try {
      const user = auth.currentUser;
      
      console.log(' Starting email change process...');
      
      // Step 1: Verify password by re-authenticating
      console.log('Step 1: Verifying password...');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      console.log(' Password verified');
      
      // Step 2: Check if new email is different
      if (newEmail === user.email) {
        throw new Error('New email must be different from current email');
      }
      
      // Step 3: Attempt to update email
      console.log('Step 2: Attempting to update email...');
      await updateEmail(user, newEmail);
      console.log(' Email updated successfully');
      
      // Step 4: Send verification email to new address
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(user);
      console.log(' Verification email sent');
      
      // Step 5: Update Firestore
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { 
          email: newEmail,
          emailVerified: false,
          updatedAt: new Date().toISOString()
        });
        console.log(' Firestore updated');
      } catch (firestoreError) {
        console.warn(' Firestore update skipped');
      }
      
      console.log(' Email change completed!');
      
    } catch (error) {
      console.error(' Email update error:', error);
      console.error('Error code:', error.code);
      
      // Better error messages
      let errorMessage = 'Failed to change email. ';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage += 'Incorrect password.';
          break;
        case 'auth/invalid-email':
          errorMessage += 'Invalid email format.';
          break;
        case 'auth/email-already-in-use':
          errorMessage += 'This email is already in use.';
          break;
        case 'auth/requires-recent-login':
          errorMessage += 'Please sign out and sign in again, then try changing your email.';
          break;
        case 'auth/operation-not-allowed':
          // This is the error you're getting - let's handle it differently
          errorMessage = 'For security reasons, please sign out and sign in again before changing your email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage += 'Too many attempts. Please try again later.';
          break;
        default:
          errorMessage += error.message || 'Please try again.';
      }
      
      throw new Error(errorMessage);
    }
  };

 // Delete user account and all associated data
    const deleteUserAccount = async (password) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');
        
        console.log(' Starting account deletion...');
        
        console.log(' Re-authenticating user...');
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        console.log(' Re-authentication successful');
        
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('userId', '==', user.uid)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);
        
        console.log(` Found ${ticketsSnapshot.size} tickets to delete`);
        
        for (const ticketDoc of ticketsSnapshot.docs) {
          await deleteDoc(doc(db, 'tickets', ticketDoc.id));
          console.log(` Deleted ticket: ${ticketDoc.id}`);
        }
        
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await deleteDoc(userDocRef);
          console.log(' Deleted user document from Firestore');
        } catch (error) {
          console.log(' No user document to delete');
        }
        
        console.log(' Clearing user data from browser storage...');
        localStorage.removeItem('userProfileImage');
        localStorage.removeItem('pendingUserProfileImage');
        sessionStorage.removeItem('pendingTicketData');
        console.log(' Browser storage cleared');
        
        await deleteUser(user);
        console.log(' Deleted Firebase Auth account');
        
        console.log(' Account deletion complete!');
        
        localStorage.clear();
        sessionStorage.clear();
        
      } catch (error) {
        console.error(' Account deletion error:', error);
        
        localStorage.removeItem('userProfileImage');
        localStorage.removeItem('pendingUserProfileImage');
        sessionStorage.clear();
        
        if (error.code === 'auth/wrong-password') {
          throw new Error('Incorrect password. Please try again.');
        } else if (error.code === 'auth/requires-recent-login') {
          throw new Error('Please sign out and sign in again before deleting your account.');
        } else {
          throw error;
        }
      }
    };

  useEffect(() => {
    console.log(' Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(' Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      setCurrentUser(user);
      
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    signin,
    logout,
    fetchUserProfile,
    linkAnonymousTickets,
    loading,
    updateUserPassword,
    updateUserEmail,
    deleteUserAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}