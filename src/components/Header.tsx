'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    // Use the logout function from AuthContext
    logout();

    // Redirect to login page
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-1">
      {/* Brand and Navigation */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-dot" />
          <Link
            href="/dashboard"
            className="font-mono text-sm tracking-wider text-text-primary uppercase font-medium"
          >
            Trading Dashboard
          </Link>
        </div>

        {/* Navigation */}
        {isAuthenticated && (
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-3"
            >
              Dashboard
            </Link>
            <Link
              href="/historical-data"
              className="px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-3"
            >
              Historical Data
            </Link>
          </nav>
        )}
      </div>

      {/* User Actions */}
      <div className="flex items-center">
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-border hover:border-accent-muted"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/"
            className="px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors bg-accent-muted text-text-primary hover:bg-accent-muted/80"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
