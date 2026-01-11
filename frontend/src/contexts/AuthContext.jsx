// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
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
      
      console.log(' Found', querySnapshot.size, 'anonymous tickets to link');
      
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

  // Sign up function - FIXED VERSION
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
      await updateProfile(user, { displayName: fullName });
      
      console.log(' Display name updated');
      
      // Step 3: Link any anonymous tickets with this email
      const linkedTicketsCount = await linkAnonymousTickets(email, user.uid);
      
      // Step 4: Create user profile in Firestore (with better error handling)
      try {
        console.log(' Creating user document in Firestore...');
        
        const userProfile = {
          uid: user.uid,
          email: user.email,
          fullName: fullName,
          role: 'user',
          createdAt: new Date().toISOString(),
          ticketsGenerated: linkedTicketsCount, // Start with linked tickets count
          emailVerified: user.emailVerified,
          lastLoginAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', user.uid), userProfile);
        console.log(' User document created in Firestore');
        
      } catch (firestoreError) {
        console.warn(' Firestore user creation failed (but auth user was created):', firestoreError);
        console.warn('This might be due to Firestore security rules');
      }
      
        sessionStorage.setItem('isNewUser', 'true');

        console.log(` Signup completed successfully! Linked ${linkedTicketsCount} existing tickets.`);
        return userCredential;
      
    } catch (error) {
      console.error(' Signup failed:', error);
      
      // Only throw if it's an actual auth error
      if (error.code && error.code.startsWith('auth/')) {
        throw error;
      } else {
        // For other errors (like Firestore), create a more user-friendly error
        console.error('Non-auth error during signup:', error);
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

  useEffect(() => {
    console.log(' Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(' Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      setCurrentUser(user);
      
      if (user) {
        // Try to fetch user profile, but don't fail if it doesn't exist
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
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}