import protobuf from 'protobufjs';

let root: protobuf.Root | null = null;
let GenericDataEnvelop: protobuf.Type | null = null;

export async function initNubraProto() {
  try {
    // Load proto file from the same path as used in WebSocket function
    root = await protobuf.load('/proto/option-chain.proto');
    GenericDataEnvelop = root.lookupType('GenericData');
  } catch (error) {
    console.error('[NubraProto] Failed to load proto file:', error);
  }
}

export function decodeOptionChainUpdate(binaryData: Uint8Array | ArrayBuffer) {
  if (!root || !GenericDataEnvelop) {
    throw new Error(
      'Proto schema not initialized. Call initNubraProto() first.'
    );
  }

  try {
    // Ensure we have Uint8Array for processing
    const buffer =
      binaryData instanceof Uint8Array
        ? binaryData
        : new Uint8Array(binaryData);

    // Try to decode as text first (for the option data object)
    try {
      const text = new TextDecoder('utf-8').decode(buffer);
      const optionData = JSON.parse(text);
      console.log('[NubraProto] Option data decoded:', optionData);
      return optionData;
    } catch (textError) {
      // If text decoding fails, try protobuf decoding
      // Decode wrapper using GenericDataEnvelop type (matches WebSocket function logic)
      const outer = GenericDataEnvelop.decode(buffer) as unknown as {
        key: string;
        data: { typeUrl: string; value: any };
      };
      console.log('[NubraProto] Decoded wrapper:', outer);

      // Check if it's an option message
      if (outer.key === 'option') {
        return outer.data.value;
      } else {
        console.log('[NubraProto] Unknown key:', outer.key);
        return { key: outer.key, data: outer.data };
      }
    }
  } catch (error) {
    console.error('[NubraProto] Decode error:', error);
    throw error;
  }
}
