'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    retryAuthentication,
  } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleManualLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await retryAuthentication();
      // The useAuthentication hook will handle the redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2">
      <div className="max-w-md w-full space-y-8 p-8 bg-surface-1 rounded-lg shadow-lg border border-border">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Options Dashboard
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in to access your trading dashboard
          </p>
        </div>

        {/* Automatic Authentication Status */}
        <div className="space-y-4">
          {authLoading && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-sm text-muted-foreground">
                Authenticating with TOTP...
              </p>
            </div>
          )}

          {authError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
              <p className="text-sm text-destructive">
                Authentication failed: {authError}
              </p>
            </div>
          )}
        </div>

        {/* Manual Login Form */}
        <div className="space-y-6">
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              onClick={handleManualLogin}
              disabled={isLoading || authLoading}
              className="group relative w-full flex justify-center py-2 px-4 border-accent-blue text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/30 text-sm font-medium rounded-md text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Authenticating...' : 'Login with TOTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
