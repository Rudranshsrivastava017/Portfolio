import {
  isEmailConfigured,
  verifyTokenAndOtp,
  sendContactNotification
} from './utils/email.js';

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['*'];

  if (allowed.includes('*') || (origin && allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const message = String(req.body?.message || '').trim();
    const otp = String(req.body?.otp || '').trim();
    const verificationToken = String(req.body?.verificationToken || '').trim();

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the 6-digit verification code.'
      });
    }

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing verification token. Please request a new verification code.'
      });
    }

    // Attempting to bypass by passing "verified: true" is strictly impossible:
    // verifyTokenAndOtp cryptographically verifies the token signature, HMAC-hashed OTP,
    // expiry timestamp, and attempts count on the backend.
    const verification = verifyTokenAndOtp(verificationToken, email, otp);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Verification succeeded! Now send the verified contact message to the owner
    if (!isEmailConfigured()) {
      if (!process.env.VERCEL) {
        console.log(`\n======================================================`);
        console.log(`[LOCAL DEV] OTP verified successfully for ${email}!`);
        console.log(`[LOCAL DEV] Contact message from: ${name} (${email})`);
        console.log(`[LOCAL DEV] Message: ${message}`);
        console.log(`[LOCAL DEV] (Configure real EMAIL_USER & EMAIL_PASS in .env to deliver email)`);
        console.log(`======================================================\n`);
      } else {
        console.error('SMTP configuration missing or placeholder in .env (EMAIL_USER / EMAIL_PASS).');
        return res.status(503).json({
          success: false,
          message: 'Email service is not configured yet. Please configure SMTP in your Vercel project settings.'
        });
      }
    } else {
      try {
        await sendContactNotification(name, email, message);
      } catch (mailErr) {
        console.error('SMTP send notification error:', mailErr);
        return res.status(500).json({
          success: false,
          message: `OTP verified, but forwarding email failed: ${mailErr.message || 'SMTP error'}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: '✓ Email verified! Your message has been sent successfully.'
    });
  } catch (error) {
    console.error('Error in verify-otp handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deliver message. Please try again later.'
    });
  }
}
