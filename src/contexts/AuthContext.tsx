import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface UserProfile {
  email: string;
  role: 'user' | 'admin';
  gateIoApiKey?: string;
  gateIoApiSecret?: string;
  fcmToken?: string;
  pin?: string;
  tickerCoins?: string[];
  tickerInterval?: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string, email: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const isAdminEmail = normalizedEmail === 'wcriz@proton.me' || uid === 'EK4rtl6BajgOQt011UMH4UTW7no2';
      
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (isAdminEmail) data.role = 'admin';
        setProfile(data);
      } else {
        const newProfile: UserProfile = {
          email: normalizedEmail,
          role: isAdminEmail ? 'admin' : 'user',
          tickerCoins: ['BTC_USDT', 'ETH_USDT', 'SUI_USDT', 'AVAX_USDT', 'BNB_USDT'],
          tickerInterval: 20
        };
        
        // Ensure initial profile creation
        await setDoc(docRef, { 
          ...newProfile, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        }, { merge: true });
        
        setProfile(newProfile);
      }
    } catch (e: any) {
      handleFirestoreError(e, OperationType.GET, `users/${uid}`);
      toast.error("Error al sincronizar perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        await fetchProfile(u.uid, u.email);
        requestFcmToken(u.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const requestFcmToken = async (uid: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      if (Notification.permission === 'granted' || await Notification.requestPermission() === 'granted') {
          // Future FCM registration logic here
      }
    } catch (e) {
      console.warn("Notification system initialization skipped");
    }
  };

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      toast.error("Error al iniciar sesión: " + e.message);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success("Sesión cerrada correctamente");
    } catch (e: any) {
      toast.error("Error al salir");
    }
  };

  const refreshProfile = async () => {
    if (user?.email) {
      await fetchProfile(user.uid, user.email);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
