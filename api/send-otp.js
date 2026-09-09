import {
  isEmailConfigured,
  validateEmailInput,
  checkCooldown,
  recordSentOtp,
  generateSecureOtp,
  createVerificationToken,
  sendOtpToVisitor,
  OTP_EXPIRY_MS
} from './utils/email.js';

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['*'];

  const isLocalOrigin = origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'null'
  );

  if (allowed.includes('*') || isLocalOrigin || (origin && allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    const rawEmail = String(req.body?.email || '').trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your name.'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name is too long (maximum 100 characters).'
      });
    }

    // Email format and domain validation
    const emailValidation = validateEmailInput(rawEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message
      });
    }
    const email = emailValidation.email;

    // Cooldown check (60 seconds resend interval)
    const cooldownCheck = checkCooldown(email);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: cooldownCheck.message,
        cooldownSeconds: cooldownCheck.remainingSeconds
      });
    }

    // Generate secure 6-digit OTP
    const otp = generateSecureOtp();
    const expiresAt = Date.now() + OTP_EXPIRY_MS; // 5 minutes

    // Create stateless, cryptographically signed verification token
    // The OTP is hashed with HMAC-SHA256 - never stored as plain text
    const verificationToken = createVerificationToken(email, otp, expiresAt);

    // Check SMTP configuration
    if (!isEmailConfigured()) {
      if (!process.env.VERCEL) {
        // In local development, if SMTP is not configured yet, log OTP to console for easy testing
        console.log(`\n======================================================`);
        console.log(`[LOCAL DEV] SMTP is not yet configured in .env.`);
        console.log(`[LOCAL DEV] Verification code for ${email}: ${otp}`);
        console.log(`[LOCAL DEV] To receive real emails in your inbox:`);
        console.log(`[LOCAL DEV] 1. Open .env`);
        console.log(`[LOCAL DEV] 2. Set EMAIL_USER to your Gmail`);
        console.log(`[LOCAL DEV] 3. Set EMAIL_PASS to your 16-character Google App Password`);
        console.log(`======================================================\n`);

        recordSentOtp(email);

        return res.status(200).json({
          success: true,
          message: `Verification code generated! (Dev mode: ${otp}). Add your Gmail App Password to .env to receive real emails.`,
          verificationToken,
          devOtp: otp,
          cooldownSeconds: 60,
          expiresInMinutes: 5
        });
      } else {
        console.error('SMTP configuration missing or placeholder in .env (EMAIL_USER / EMAIL_PASS).');
        return res.status(503).json({
          success: false,
          message: 'Email service is not configured yet. Please configure SMTP in your Vercel project settings.'
        });
      }
    }

    // SMTP is configured - attempt real email dispatch
    try {
      await sendOtpToVisitor(email, name, otp);
    } catch (mailErr) {
      console.error('SMTP send error:', mailErr);
      if (mailErr.code === 'EAUTH' || mailErr.responseCode === 535) {
        return res.status(401).json({
          success: false,
          message: 'Gmail authentication failed. Please ensure EMAIL_PASS in .env is a 16-character Google App Password (not your standard login password).'
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to deliver email: ${mailErr.message || 'SMTP connection error'}`
      });
    }

    // Record cooldown timestamp
    recordSentOtp(email);

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
      verificationToken,
      cooldownSeconds: 60,
      expiresInMinutes: 5
    });
  } catch (error) {
    console.error('Error in send-otp handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please check your email or try again later.'
    });
  }
}
