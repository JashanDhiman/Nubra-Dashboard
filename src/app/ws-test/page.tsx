'use client';

import { useEffect, useState } from 'react';
import protobuf from 'protobufjs';

export default function WebSocketComponent() {
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
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
        };

        ws.onmessage = event => {
          try {
            if (event.data instanceof ArrayBuffer) {
              const buffer = new Uint8Array(event.data);

              // ✅ Decode wrapper
              const outer = GenericData.decode(buffer) as unknown as {
                key: string;
                data: any;
              };
              console.log('✅ Outer:', outer);

              if (outer.key === 'option') {
                setMessages(prev => [
                  { timestamp: Date.now(), data: outer.data.expiry },
                  ...prev.slice(0, 20),
                ]);
              }
            }
          } catch (err) {
            console.error('❌ Decode error:', err);
          }
        };

        ws.onerror = err => {
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
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Nubra WebSocket Data Streaming
        </h1>
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
