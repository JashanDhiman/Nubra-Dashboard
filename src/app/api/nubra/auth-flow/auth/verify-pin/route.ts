import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pin, authToken } = await request.json();

    if (!pin || !authToken) {
      return NextResponse.json(
        { error: 'PIN and authToken are required' },
        { status: 400 }
      );
    }

    // Use device ID from environment variables
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';

    // Step 4: Verify PIN
    const verifyResponse = await axios.post(
      `${process.env.NUBRA_BASE_URL}/verifypin`,
      {
        pin,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-device-id': deviceId,
        },
      }
    );

    console.log('verifyPINResponse', verifyResponse.data);

    const sessionToken = verifyResponse.data.session_token;
    const userId = verifyResponse.data.userId;
    const email = verifyResponse.data.email;

    // Return success response with final session token
    return NextResponse.json({
      message: 'Login successful',
      sessionToken,
      userId,
      email,
    });
  } catch (error: any) {
    console.error('PIN verification error:', error);
    return NextResponse.json(
      {
        error: 'PIN verification failed',
        details: error.response?.data?.message || error.message,
      },
      { status: 500 }
    );
  }
}
