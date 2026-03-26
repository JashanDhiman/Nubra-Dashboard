'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function Header() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const sessionToken = localStorage.getItem('sessionToken');
    setIsAuthenticated(!!sessionToken);
  }, []);

  const handleLogout = () => {
    // Clear session
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    router.push('/');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center">
          {/* Logo and Navigation */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
              Nubra Dashboard
            </Link>

            {isAuthenticated && (
              <nav className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/historical-data"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
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
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/"
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-sm font-medium"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
