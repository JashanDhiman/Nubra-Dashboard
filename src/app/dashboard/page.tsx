'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveOptionChain } from '@/hooks/useLiveOptionChain';
import { useDashboardStore } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { TopBar } from '@/components/ui/TopBar';
import { ConnectionBar } from '@/components/ui/ConnectionBar';
import { StatsRow } from '@/components/ui/StatsRow';
import { ChainControls } from '@/components/ui/ChainControls';
import { OptionChainTable } from '@/components/OptionChainTable';
import { SidePanel } from '@/components/SidePanel';
import { Header } from '@/components/Header';

export default function DashboardPage() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
  } = useAuth();
  const router = useRouter();
  const { filter, setFilter, expiries } = useDashboardStore();

  // Kick off live data pipeline - must be called before any conditional returns
  useLiveOptionChain();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Set default expiry once expiries load
  useEffect(() => {
    if (expiries.length > 0 && !filter.expiry) {
      setFilter({ expiry: expiries[0] });
    }
  }, [expiries, filter.expiry, setFilter]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-center max-w-md p-6 bg-surface-1 rounded-lg shadow border border-border">
          <p className="text-destructive mb-4">
            Authentication failed: {authError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry Authentication
          </button>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex flex-col h-screen overflow-hidden bg-surface">
        {/* Top navigation bar */}
        <TopBar />

        {/* Connection status bar */}
        <ConnectionBar />

        {/* Key metrics row */}
        <StatsRow />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Option chain table + controls */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <ChainControls />
            <div className="flex-1 overflow-auto">
              <OptionChainTable />
            </div>
          </div>

          {/* Side panel — charts + order entry */}
          <SidePanel />
        </div>
      </div>
    </div>
  );
}
