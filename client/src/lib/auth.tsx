import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseClientConfigured } from './firebase';
import { setFirestoreAuthUser } from './firestoreApi';

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isFirebaseEnabled: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  isAdmin: false,
  isFirebaseEnabled: false,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

const USE_FIRESTORE_DIRECT = import.meta.env.VITE_USE_FIRESTORE_DIRECT === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const shouldUseAuth = isFirebaseClientConfigured && Boolean(auth);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState<boolean>(shouldUseAuth && USE_FIRESTORE_DIRECT);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldUseAuth || !auth) {
      setFirestoreAuthUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        let adminClaim = false;
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          adminClaim = tokenResult.claims.admin === true;
        } catch {
          adminClaim = false;
        }
        setUser(fbUser);
        setIsAdmin(adminClaim);
        setFirestoreAuthUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          isAdmin: adminClaim,
        });
      } else {
        setUser(null);
        setIsAdmin(false);
        setFirestoreAuthUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [shouldUseAuth]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      setAuthError('目前環境尚未設定 Firebase Auth，暫以訪客本機模式運作。');
      return;
    }
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        setAuthError(
          'Firebase 專案尚未啟用 Google 登入提供者。請至 Firebase Console ➜ Authentication ➜ Sign-in method 開啟 Google 登入。'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          '目前網域尚未加入 Firebase Auth 授權清單。請至 Firebase Console ➜ Authentication ➜ Settings ➜ Authorized domains 加入此網域。'
        );
      } else {
        setAuthError(`登入失敗：${(err as Error).message}`);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    setAuthError(null);
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isFirebaseEnabled: shouldUseAuth,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
