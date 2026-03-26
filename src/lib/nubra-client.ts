import axios from 'axios';
import speakeasy from 'speakeasy';

let sessionToken: string | null = null;
let tokenExpiry: number | null = null;

export const generateTOTP = () => {
  return speakeasy.totp({
    secret: process.env.NUBRA_TOTP_SECRET!,
    encoding: 'base32',
  });
};

export const authenticateNubra = async () => {
  const totp = generateTOTP();
  console.log('totp', totp);

  const res = await axios.post(`${process.env.NUBRA_BASE_URL}/auth`, {
    client_id: process.env.NUBRA_CLIENT_ID,
    mpin: process.env.NUBRA_MPIN,
    totp,
  });

  console.log('res', res.data);

  sessionToken = res.data.session_token;

  // assuming expiry in seconds (adjust based on API)
  tokenExpiry = Date.now() + 50 * 60 * 1000;

  return sessionToken;
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
