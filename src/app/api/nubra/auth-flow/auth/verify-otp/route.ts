import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone, otp, tempToken } = await request.json();

    if (!phone || !otp || !tempToken) {
      return NextResponse.json(
        { error: 'Phone, OTP, and tempToken are required' },
        { status: 400 }
      );
    }

    // Use device ID from environment variables
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';

    // Step 3: Verify OTP
    const verifyResponse = await axios.post(
      `${process.env.NUBRA_BASE_URL}/verifyphoneotp`,
      {
        phone,
        otp,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-temp-token': tempToken,
          'x-device-id': deviceId,
        },
      }
    );

    console.log('verifyOTPResponse', verifyResponse.data);

    const authToken = verifyResponse.data.auth_token;

    // Return success response with auth token
    return NextResponse.json({
      message: 'OTP verified successfully',
      authToken,
    });
  } catch (error: any) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      {
        error: 'OTP verification failed',
        details: error.response?.data?.message || error.message,
      },
      { status: 500 }
    );
  }
}
