'use client'

import { useEffect, useState } from 'react';
import protobuf from 'protobufjs';

export default function WebSocketComponent() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    let ws: WebSocket;

    const init = async () => {
      try {
        // ✅ Load proto file
        const root = await protobuf.load('/proto/option-chain.proto');

        // ✅ Create WebSocket
        ws = new WebSocket(
          `wss://api.nubra.io/apibatch/ws?token=${localStorage.getItem('sessionToken')}`
        );

        ws.binaryType = 'arraybuffer';
        const GenericData = root.lookupType('GenericData');

        ws.onopen = () => {
          setStatus('connected');
          console.log('✅ WebSocket connected');
          const optionMessage = `batch_subscribe ${localStorage.getItem('sessionToken')} option [{"exchange":"NSE","asset":"NIFTY","expiry":"20260413"}]`;
          console.log('[NubraWS] Subscribing to option chain');
          ws.send(optionMessage);
          // Enabling post market data
          //const postMarketMessage = `batch_subscribe ${localStorage.getItem('sessionToken')} post_market true`;
          //ws.send(postMarketMessage);
        };

        ws.onmessage = (event) => {
          try {
            if (event.data instanceof ArrayBuffer) {
              const buffer = new Uint8Array(event.data);

              // ✅ Decode wrapper
              const outer = GenericData.decode(buffer) as unknown as { key: string; data: any };
              console.log('✅ Outer:', outer);

              if (outer.key === "option") {
                setMessages(prev => [
                  { timestamp: Date.now(), data: outer.data.expiry },
                  ...prev.slice(0, 20)
                ]);
              }
            }

          } catch (err) {
            console.error('❌ Decode error:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('❌ WebSocket error:', err);
          setStatus('error');
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket closed');
          setStatus('disconnected');
        };
      } catch (err) {
        console.error('❌ Proto load error:', err);
      }
    };

    init();

    // ✅ Cleanup
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Nubra WebSocket Data Streaming</h1>
        <div className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <span className={getStatusColor()}>{status.toUpperCase()}</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Messages</h2>
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500">No messages received yet</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="mb-3 p-3 bg-black rounded border">
                <div className="text-xs text-gray-500 mb-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(msg.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================================

//'use client';

//import { useEffect } from 'react';
//import { useRouter } from 'next/navigation';

//export default function HomePage() {
//  const router = useRouter();

//  useEffect(() => {
//    // Redirect to dashboard, which will handle authentication
//    router.push('/dashboard');
//  }, [router]);

//  return (
//    <div className="min-h-screen flex items-center justify-center bg-surface-2">
//      <div className="text-center">
//        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
//        <p className="mt-2 text-muted-foreground">
//          Redirecting to dashboard...
//        </p>
//      </div>
//    </div>
//  );
//}

// ===============================its phone otp based authentication===============================

//'use client';

//import { useState } from 'react';
//import { useRouter } from 'next/navigation';

//type AuthStep = 'phone' | 'otp' | 'pin' | 'success';

//export default function Login() {
//  const router = useRouter();
//  const [phone, setPhone] = useState('8240444180');
//  const [otp, setOtp] = useState('');
//  const [pin, setPin] = useState('');
//  const [step, setStep] = useState<AuthStep>('phone');
//  const [tempToken, setTempToken] = useState('');
//  const [authToken, setAuthToken] = useState('');
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState('');

//  const handleSendOTP = async (e: React.FormEvent) => {
//    e.preventDefault();
//    setLoading(true);
//    setError('');

//    try {
//      const response = await fetch('/api/nubra/auth-flow/auth/send-phone-otp', {
//        method: 'POST',
//        headers: { 'Content-Type': 'application/json' },
//        body: JSON.stringify({ phone }),
//      });

//      const data = await response.json();

//      if (response.ok) {
//        setTempToken(data.tempToken);
//        setStep('otp');
//      } else {
//        setError(data.error || 'Failed to send OTP');
//      }
//    } catch (err) {
//      setError('Network error. Please try again.');
//    } finally {
//      setLoading(false);
//    }
//  };

//  const handleVerifyOTP = async (e: React.FormEvent) => {
//    e.preventDefault();
//    setLoading(true);
//    setError('');

//    try {
//      const response = await fetch('/api/nubra/auth-flow/auth/verify-otp', {
//        method: 'POST',
//        headers: { 'Content-Type': 'application/json' },
//        body: JSON.stringify({ phone, otp, tempToken }),
//      });

//      const data = await response.json();

//      if (response.ok) {
//        setAuthToken(data.authToken);

//        // Auto-verify PIN using environment variable
//        const envMpin = process.env.NEXT_PUBLIC_NUBRA_MPIN;
//        if (!envMpin) {
//          setError('MPIN not configured in environment variables');
//          setLoading(false);
//          return;
//        }

//        // Directly verify PIN without showing the PIN input step
//        const pinResponse = await fetch('/api/nubra/auth-flow/auth/verify-pin', {
//          method: 'POST',
//          headers: { 'Content-Type': 'application/json' },
//          body: JSON.stringify({ pin: envMpin, authToken: data.authToken }),
//        });

//        const pinData = await pinResponse.json();

//        if (pinResponse.ok) {
//          // Store session token for future API calls
//          localStorage.setItem('sessionToken', pinData.sessionToken);
//          localStorage.setItem('userId', pinData.userId.toString());
//          setStep('success');

//          // Redirect to dashboard after successful login
//          setTimeout(() => {
//            router.push('/dashboard');
//          }, 1500);
//        } else {
//          setError(pinData.error || 'Failed to verify MPIN');
//        }
//      } else {
//        setError(data.error || 'Failed to verify OTP');
//      }
//    } catch (err) {
//      setError('Network error. Please try again.');
//    } finally {
//      setLoading(false);
//    }
//  };

//  const handleVerifyPIN = async (e: React.FormEvent) => {
//    e.preventDefault();
//    setLoading(true);
//    setError('');

//    try {
//      const response = await fetch('/api/nubra/auth-flow/auth/verify-pin', {
//        method: 'POST',
//        headers: { 'Content-Type': 'application/json' },
//        body: JSON.stringify({ pin, authToken }),
//      });

//      const data = await response.json();

//      if (response.ok) {
//        // Store session token for future API calls
//        localStorage.setItem('sessionToken', data.sessionToken);
//        localStorage.setItem('userId', data.userId.toString());
//        setStep('success');

//        // Redirect to dashboard after successful login
//        setTimeout(() => {
//          router.push('/dashboard');
//        }, 1500);
//      } else {
//        setError(data.error || 'Failed to verify PIN');
//      }
//    } catch (err) {
//      setError('Network error. Please try again.');
//    } finally {
//      setLoading(false);
//    }
//  };

//  return (
//    <div className="min-h-screen flex items-center justify-center bg-gray-50">
//      <div className="max-w-md w-full space-y-8 p-8">
//        <div>
//          <h2 className="text-center text-3xl font-extrabold text-gray-900">
//            Nubra Options Dashboard
//          </h2>
//          <p className="mt-2 text-center text-sm text-gray-600">
//            {step === 'phone' && 'Enter your phone number to start'}
//            {step === 'otp' && 'Enter the OTP sent to your phone'}
//            {/* {step === 'pin' && 'Enter your MPIN to complete login'} */}
//            {step === 'success' && 'Login successful! Redirecting...'}
//          </p>
//        </div>

//        {error && (
//          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
//            {error}
//          </div>
//        )}

//        {step === 'phone' && (
//          <form onSubmit={handleSendOTP} className="space-y-6">
//            <div>
//              <input
//                type="tel"
//                placeholder="Phone Number"
//                value={phone}
//                onChange={e => setPhone(e.target.value)}
//                className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                required
//              />
//            </div>
//            <button
//              type="submit"
//              disabled={loading}
//              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
//            >
//              {loading ? 'Sending...' : 'Send OTP'}
//            </button>
//          </form>
//        )}

//        {step === 'otp' && (
//          <form onSubmit={handleVerifyOTP} className="space-y-6">
//            <div>
//              <input
//                type="text"
//                placeholder="Enter OTP"
//                value={otp}
//                onChange={e => setOtp(e.target.value)}
//                className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                required
//              />
//            </div>
//            <button
//              type="submit"
//              disabled={loading}
//              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
//            >
//              {loading ? 'Verifying...' : 'Verify OTP'}
//            </button>
//          </form>
//        )}

//        {/* step === 'pin' && (
//          <form onSubmit={handleVerifyPIN} className="space-y-6">
//            <div>
//              <input
//                type="password"
//                placeholder="Enter MPIN"
//                value={pin}
//                onChange={e => setPin(e.target.value)}
//                className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                required
//                maxLength={4}
//              />
//            </div>
//            <button
//              type="submit"
//              disabled={loading}
//              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
//            >
//              {loading ? 'Verifying...' : 'Verify PIN'}
//            </button>
//          </form>
//        ) */}

//        {step === 'success' && (
//          <div className="space-y-6">
//            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
//              <p className="font-medium">Login Successful!</p>
//              <p className="text-sm mt-1">Redirecting to dashboard...</p>
//            </div>
//          </div>
//        )}

//        {step === 'otp' && (
//          <button
//            onClick={() => setStep('phone')}
//            className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
//          >
//            ← Back to Phone Number
//          </button>
//        )}
//      </div>
//    </div>
//  );
//}
