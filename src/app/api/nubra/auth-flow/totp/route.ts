import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

export async function POST(request: NextRequest) {
  try {
    // Generate TOTP using server-side environment variables
    const secret = process.env.NUBRA_TOTP_SECRET;
    const email = process.env.NUBRA_EMAIL;
    const mpin = process.env.NUBRA_MPIN;
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';

    if (!secret || !email || !mpin) {
      return NextResponse.json(
        { error: 'Missing required environment variables' },
        { status: 500 }
      );
    }

    // Generate TOTP
    let totp;
    try {
      // Check if secret looks like base32
      if (/^[A-Z2-7]+=*$/.test(secret.toUpperCase())) {
        totp = speakeasy.totp({
          secret: secret,
          encoding: 'base32',
        });
      } else {
        // Try as ascii string
        totp = speakeasy.totp({
          secret: secret,
          encoding: 'ascii',
        });
      }
    } catch (error) {
      console.error('TOTP generation failed:', error);
      return NextResponse.json(
        { error: 'Failed to generate TOTP' },
        { status: 500 }
      );
    }

    console.log('Generated TOTP:', totp);

    // Step 1: TOTP Login
    const totpResponse = await fetch(
      `${process.env.NUBRA_BASE_URL}/totp/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          email: email,
          totp: parseInt(totp, 10),
        }),
      }
    );

    if (!totpResponse.ok) {
      const errorText = await totpResponse.text();
      console.error('TOTP login failed:', totpResponse.status, errorText);
      return NextResponse.json(
        { error: `TOTP login failed: ${errorText}` },
        { status: totpResponse.status }
      );
    }

    const totpData = await totpResponse.json();

    if (!totpData.auth_token) {
      return NextResponse.json(
        { error: 'No auth_token received from TOTP login' },
        { status: 500 }
      );
    }

    // Step 2: Verify MPIN
    const verifyResponse = await fetch(
      `${process.env.NUBRA_BASE_URL}/verifypin`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${totpData.auth_token}`,
          'x-device-id': deviceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pin: mpin,
        }),
      }
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error(
        'MPIN verification failed:',
        verifyResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: `MPIN verification failed: ${errorText}` },
        { status: verifyResponse.status }
      );
    }

    const verifyData = await verifyResponse.json();

    if (!verifyData.session_token) {
      return NextResponse.json(
        { error: 'No session_token received from MPIN verification' },
        { status: 500 }
      );
    }

    console.log('Authentication successful', verifyData);

    return NextResponse.json({
      success: true,
      session_token: verifyData.session_token,
      userId: verifyData.userId,
      email: verifyData.email,
      ws_token: verifyData.env_info?.ws_token,
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
