import { useEffect, useState } from 'react';

export function useAuthentication() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndAuthenticate = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if we already have a valid session token
        const existingToken = localStorage.getItem('sessionToken');
        if (existingToken) {
          // TODO: You might want to validate if the token is still valid
          // For now, consider it valid if it exists
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        // If no token, authenticate using API route
        console.log(
          '[useAuthentication] No session token found, authenticating...'
        );
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
          console.log('[useAuthentication] Authentication successful');
        } else {
          throw new Error('Failed to obtain session token');
        }
      } catch (err) {
        console.error('[useAuthentication] Authentication failed:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsAuthenticated(false);

        // Clear any invalid token
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userId');
      } finally {
        setIsLoading(false);
      }
    };

    checkAndAuthenticate();
  }, []);

  const retryAuthentication = async () => {
    setIsLoading(true);
    setError(null);

    try {
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
        console.log('[useAuthentication] Re-authentication successful');
      }
    } catch (err) {
      console.error('[useAuthentication] Re-authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userId');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    retryAuthentication,
  };
}
