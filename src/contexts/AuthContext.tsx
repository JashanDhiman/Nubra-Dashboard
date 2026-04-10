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
  wsToken: string | null;
  sessionToken: string | null;
  marketWsUrl: string | null;
  userWsUrl: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [marketWsUrl, setMarketWsUrl] = useState<string | null>(null);
  const [userWsUrl, setUserWsUrl] = useState<string | null>(null);

  const authenticate = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we already have a valid session token
      const existingToken = localStorage.getItem('sessionToken');
      const existingWsToken = localStorage.getItem('wsToken');
      const existingMarketWsUrl = localStorage.getItem('marketWsUrl');
      const existingUserWsUrl = localStorage.getItem('userWsUrl');

      if (existingToken) {
        setWsToken(existingWsToken);
        setSessionToken(existingToken);
        setMarketWsUrl(existingMarketWsUrl);
        setUserWsUrl(existingUserWsUrl);
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
        localStorage.setItem('wsToken', data.ws_token || '');
        localStorage.setItem('marketWsUrl', data.market_ws_url || '');
        localStorage.setItem('userWsUrl', data.user_ws_url || '');

        setWsToken(data.ws_token || null);
        setSessionToken(data.session_token || null);
        setMarketWsUrl(data.market_ws_url || null);
        setUserWsUrl(data.user_ws_url || null);
        setIsAuthenticated(true);
      } else {
        throw new Error('Failed to obtain session token');
      }
    } catch (err) {
      console.error('[AuthProvider] Authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('wsToken');
      localStorage.removeItem('marketWsUrl');
      localStorage.removeItem('userWsUrl');

      setWsToken(null);
      setSessionToken(null);
      setMarketWsUrl(null);
      setUserWsUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear session from localStorage
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('wsToken');
    localStorage.removeItem('marketWsUrl');
    localStorage.removeItem('userWsUrl');

    // Update state
    setIsAuthenticated(false);
    setError(null);
    setWsToken(null);
    setSessionToken(null);
    setMarketWsUrl(null);
    setUserWsUrl(null);
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
        sessionToken,
        wsToken,
        marketWsUrl,
        userWsUrl,
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
