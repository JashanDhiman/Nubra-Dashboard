import axios from 'axios';
import speakeasy from 'speakeasy';

let sessionToken: string | null = null;
let tokenExpiry: number | null = null;

export const generateTOTP = () => {
  const secret = process.env.NUBRA_TOTP_SECRET;

  if (!secret) {
    throw new Error('NUBRA_TOTP_SECRET environment variable is not set');
  }

  try {
    // Try different encoding methods based on secret format
    let totp;

    // Check if secret looks like base32 (contains only base32 characters)
    if (/^[A-Z2-7]+=*$/.test(secret.toUpperCase())) {
      totp = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });
    } else {
      // Try as ascii/utf8 string
      totp = speakeasy.totp({
        secret: secret,
        encoding: 'ascii',
      });
    }

    return totp;
  } catch (error) {
    console.error('TOTP generation failed:', error);
    throw new Error(
      `Failed to generate TOTP: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const authenticateNubra = async () => {
  try {
    const totp = generateTOTP();
    console.log('Generated TOTP:', totp);

    // Validate environment variables
    const email = process.env.NUBRA_EMAIL;
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';

    if (!email) {
      throw new Error('NUBRA_EMAIL environment variable is not set');
    }

    // Step 1: TOTP Login to get auth_token
    console.log('Step 1: Attempting TOTP login...');
    const totpResponse = await fetch('https://api.nubra.io/totp/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        email: email,
        totp: parseInt(totp, 10), // Convert string TOTP to number
      }),
    });

    if (!totpResponse.ok) {
      const errorText = await totpResponse.text();
      console.error('TOTP login failed:', totpResponse.status, errorText);
      throw new Error(
        `TOTP login failed (${totpResponse.status}): ${errorText}`
      );
    }

    const totpData = await totpResponse.json();
    console.log('TOTP login successful:', totpData);

    if (!totpData.auth_token) {
      throw new Error('No auth_token received from TOTP login');
    }

    // Step 2: Verify MPIN to get session_token
    console.log('Step 2: Verifying MPIN...');
    const verifyResponse = await fetch('https://api.nubra.io/verifypin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${totpData.auth_token}`,
        'x-device-id': deviceId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pin: process.env.NUBRA_MPIN,
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error(
        'MPIN verification failed:',
        verifyResponse.status,
        errorText
      );
      throw new Error(
        `MPIN verification failed (${verifyResponse.status}): ${errorText}`
      );
    }

    const verifyData = await verifyResponse.json();
    console.log('MPIN verification successful:', verifyData);

    if (!verifyData.session_token) {
      throw new Error('No session_token received from MPIN verification');
    }

    sessionToken = verifyData.session_token;
    // assuming expiry in seconds (adjust based on API)
    tokenExpiry = Date.now() + 50 * 60 * 1000;

    console.log('Authentication complete, session token stored');
    return sessionToken;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error; // Re-throw to let the calling component handle it
  }
};

export const setSessionToken = (token: string) => {
  sessionToken = token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes from now
};

export const getValidToken = async () => {
  if (!sessionToken || !tokenExpiry || Date.now() > tokenExpiry) {
    return await authenticateNubra();
  }

  return sessionToken;
};

// Nubra client with methods for API calls
export const nubraClient = {
  setSessionToken,

  getSessionToken(): string | null {
    return sessionToken;
  },

  async getOptionChain(underlying: string, expiry: string) {
    if (!sessionToken) {
      throw new Error('No session token available. Please login first.');
    }

    const response = await axios.get(
      `${process.env.NUBRA_BASE_URL}/options-chain`,
      {
        params: { underlying, expiry },
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  async getExpiries(underlying: string) {
    if (!sessionToken) {
      throw new Error('No session token available. Please login first.');
    }

    const response = await axios.get(`${process.env.NUBRA_BASE_URL}/expiries`, {
      params: { underlying },
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.expiries;
  },

  async placeOrder(orderData: any) {
    if (!sessionToken) {
      throw new Error('No session token available. Please login first.');
    }

    const response = await axios.post(
      `${process.env.NUBRA_BASE_URL}/order`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  async getOrders() {
    if (!sessionToken) {
      throw new Error('No session token available. Please login first.');
    }

    const response = await axios.get(`${process.env.NUBRA_BASE_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.orders;
  },
};
