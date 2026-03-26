'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AuthStep = 'phone' | 'otp' | 'pin' | 'success';

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('8240444180');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<AuthStep>('phone');
  const [tempToken, setTempToken] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/nubra/auth-flow/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (response.ok) {
        setTempToken(data.tempToken);
        setStep('otp');
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/nubra/auth-flow/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, tempToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthToken(data.authToken);
        setStep('pin');
      } else {
        setError(data.error || 'Failed to verify OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/nubra/auth-flow/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, authToken }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store session token for future API calls
        localStorage.setItem('sessionToken', data.sessionToken);
        localStorage.setItem('userId', data.userId.toString());
        setStep('success');

        // Redirect to dashboard after successful login
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(data.error || 'Failed to verify PIN');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Nubra Options Dashboard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'phone' && 'Enter your phone number to start'}
            {step === 'otp' && 'Enter the OTP sent to your phone'}
            {step === 'pin' && 'Enter your MPIN to complete login'}
            {step === 'success' && 'Login successful! Redirecting...'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={handleVerifyPIN} className="space-y-6">
            <div>
              <input
                type="password"
                placeholder="Enter MPIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                maxLength={4}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify PIN'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">Login Successful!</p>
              <p className="text-sm mt-1">Redirecting to dashboard...</p>
            </div>
          </div>
        )}

        {step !== 'phone' && step !== 'success' && (
          <button
            onClick={() => setStep('phone')}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
          >
            ← Back to Phone Number
          </button>
        )}
      </div>
    </div>
  );
}
