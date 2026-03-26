'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  retryAuthentication: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authenticate = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we already have a valid session token
      const existingToken = localStorage.getItem('sessionToken');
      if (existingToken) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // If no token, authenticate using API route
      console.log('[AuthProvider] No session token found, authenticating...');
      const response = await fetch('/api/nubra/auth-flow/totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await response.json();

      if (data.success && data.session_token) {
        localStorage.setItem('sessionToken', data.session_token);
        localStorage.setItem('userId', data.userId?.toString() || '');
        setIsAuthenticated(true);
        console.log('[AuthProvider] Authentication successful');
      } else {
        throw new Error('Failed to obtain session token');
      }
    } catch (err) {
      console.error('[AuthProvider] Authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userId');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear session from localStorage
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');

    // Update state
    setIsAuthenticated(false);
    setError(null);
  };

  const retryAuthentication = async () => {
    setError(null);
    await authenticate();
  };

  useEffect(() => {
    authenticate();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        retryAuthentication,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
