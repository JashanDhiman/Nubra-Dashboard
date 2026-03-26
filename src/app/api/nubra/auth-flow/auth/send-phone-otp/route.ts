import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Step 1: Generate Temporary Token
    const otpResponse = await axios.post(
      `${process.env.NUBRA_BASE_URL}/sendphoneotp`,
      {
        phone,
        skip_totp: false,
      }
    );

    console.log('otpResponse', otpResponse.data);

    const tempToken = otpResponse.data.temp_token;

    // Step 2: Send OTP
    const verifyResponse = await axios.post(
      `${process.env.NUBRA_BASE_URL}/sendphoneotp`,
      {
        //pin: process.env.NUBRA_MPIN,
        phone,
        skip_totp: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-temp-token': tempToken,
          'x-device-id': process.env.NUBRA_DEVICE_ID || 'dashboard-device',
        },
      }
    );

    console.log('verifyResponse', verifyResponse.data);

    const newTempToken = verifyResponse.data.temp_token;

    // Return success response with temp token for next steps
    return NextResponse.json({
      message: 'OTP sent successfully',
      tempToken: newTempToken,
    });
  } catch (error: any) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      {
        error: 'Authentication failed',
        details: error.response?.data?.message || error.message,
      },
      { status: 500 }
    );
  }
}
