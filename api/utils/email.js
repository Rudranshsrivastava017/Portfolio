import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Global in-memory state for rate limiting, attempts, and replay protection
// Works across requests within the serverless function instance / dev server
const otpAttempts = new Map(); // tokenId -> attempt count (max 5)
const emailCooldowns = new Map(); // normalized email -> timestamp of last OTP sent
const consumedTokens = new Set(); // tokenId set to prevent replay

// Periodic cleanup of expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, timestamp] of emailCooldowns.entries()) {
    if (now - timestamp > 3600000) { // 1 hour
      emailCooldowns.delete(email);
    }
  }
  for (const [tokenId, data] of otpAttempts.entries()) {
    if (now - (data.createdAt || now) > 600000) { // 10 minutes
      otpAttempts.delete(tokenId);
      consumedTokens.delete(tokenId);
    }
  }
}, 600000).unref?.();

// Secret key for HMAC signing
const SECRET_KEY = process.env.OTP_SECRET || 'portfolio-otp-secret-key-fallback-2026-rudransh-srivastava';

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export function isEmailConfigured() {
  dotenv.config({ override: true });
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return false;
  if (
    user === 'your-email@gmail.com' ||
    pass === 'your-app-password' ||
    pass === 'your-gmail-app-password' ||
    pass.trim() === ''
  ) {
    return false;
  }
  return true;
}

export function getTransporter() {
  dotenv.config({ override: true });
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = port === 465;
  const rawPass = process.env.EMAIL_PASS || '';
  const cleanPass = rawPass.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: (process.env.EMAIL_USER || '').trim(),
      pass: cleanPass
    }
  });
}

export function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

// Domain & syntax validation
const BLOCKED_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'throwawaymail.com',
  'sharklasers.com',
  'yopmail.com',
  'dispostable.com',
  'trashmail.com',
  'fake.com',
  'example.com',
  'test.com',
  'asdf.com'
]);

const DOMAIN_TYPOS = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outloo.com': 'outlook.com'
};

export function validateEmailInput(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, message: 'Email address is required.' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalized) || normalized.includes('..') || normalized.includes('@.') || normalized.includes('.@')) {
    return { valid: false, message: 'Please enter a valid email address format.' };
  }

  const domain = normalized.split('@')[1];
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, message: 'Temporary or disposable email addresses are not allowed.' };
  }

  if (DOMAIN_TYPOS[domain]) {
    return { valid: false, message: `Did you mean @${DOMAIN_TYPOS[domain]}?` };
  }

  return { valid: true, email: normalized };
}

// Cooldown check for resending OTP
export function checkCooldown(email) {
  const normalized = email.toLowerCase().trim();
  const lastSent = emailCooldowns.get(normalized);
  if (!lastSent) return { allowed: true };

  const elapsed = Date.now() - lastSent;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return {
      allowed: false,
      remainingSeconds,
      message: `Please wait ${remainingSeconds} second(s) before requesting another code.`
    };
  }
  return { allowed: true };
}

export function recordSentOtp(email) {
  emailCooldowns.set(email.toLowerCase().trim(), Date.now());
}

// Cryptographic OTP Generation
export function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString(); // 6-digit numeric string
}

// Hash OTP with salt/secret - never stored in plain text
export function hashOtp(email, otp, expiresAt) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${email.toLowerCase().trim()}:${otp}:${expiresAt}`)
    .digest('hex');
}

// Generate signed verification token containing hashed OTP
export function createVerificationToken(email, otp, expiresAt) {
  const tokenId = crypto.randomUUID();
  const otpHotHash = hashOtp(email, otp, expiresAt);

  const payload = {
    tokenId,
    email: email.toLowerCase().trim(),
    expiresAt,
    otpHotHash
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64url');

  // Track attempts for this tokenId
  otpAttempts.set(tokenId, { count: 0, createdAt: Date.now() });

  return `${payloadStr}.${signature}`;
}

// Verify token and entered OTP
export function verifyTokenAndOtp(token, email, inputOtp) {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'Missing verification token. Please request a new code.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, message: 'Invalid verification token format.' };
  }

  const [payloadStr, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64url');

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, message: 'Verification token signature is invalid or has been tampered with.' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, message: 'Malformed verification token payload.' };
  }

  const { tokenId, email: tokenEmail, expiresAt, otpHotHash } = payload;
  const normalizedEmail = email.toLowerCase().trim();

  if (normalizedEmail !== tokenEmail) {
    return { valid: false, message: 'Email address does not match the verification token.' };
  }

  // Check if token was already consumed
  if (consumedTokens.has(tokenId)) {
    return { valid: false, message: 'This verification code has already been used. Please request a new code.' };
  }

  // Check expiry (5 minutes)
  if (Date.now() > expiresAt) {
    return { valid: false, message: 'Verification code has expired. Please request a new code.' };
  }

  // Check attempt limit (max 5)
  const attemptData = otpAttempts.get(tokenId) || { count: 0 };
  if (attemptData.count >= MAX_ATTEMPTS) {
    consumedTokens.add(tokenId); // invalidate completely
    return { valid: false, message: 'Maximum verification attempts exceeded. Please request a new code.' };
  }

  // Increment attempts
  attemptData.count += 1;
  otpAttempts.set(tokenId, attemptData);

  // Compute hash of entered OTP and compare using timingSafeEqual
  const cleanInputOtp = String(inputOtp || '').trim();
  const inputHash = hashOtp(normalizedEmail, cleanInputOtp, expiresAt);

  const hashBuffer = Buffer.from(inputHash);
  const targetBuffer = Buffer.from(otpHotHash);

  if (hashBuffer.length !== targetBuffer.length || !crypto.timingSafeEqual(hashBuffer, targetBuffer)) {
    const remaining = MAX_ATTEMPTS - attemptData.count;
    const attemptWarning = remaining > 0 ? ` (${remaining} attempt(s) remaining)` : '';
    return { valid: false, message: `Incorrect verification code.${attemptWarning}` };
  }

  // Valid OTP! Mark token as consumed so it cannot be replayed
  consumedTokens.add(tokenId);
  otpAttempts.delete(tokenId);

  return { valid: true, email: normalizedEmail };
}

// Send OTP email to visitor
export async function sendOtpToVisitor(toEmail, toName, otp) {
  const transporter = getTransporter();
  const fromAddress = `"${process.env.EMAIL_SENDER_NAME || 'Rudransh Portfolio'}" <${process.env.EMAIL_USER}>`;

  const subject = `Your Verification Code: ${otp}`;
  const textBody = `Hello ${toName || 'there'},\n\n` +
    `Your verification code is: ${otp}\n\n` +
    `This code will expire in 5 minutes.\n` +
    `Enter this code into the portfolio contact form to verify access to this email mailbox.\n\n` +
    `Notice: This verification strictly confirms access to this email mailbox at this time. It does not certify individual identity or trustworthiness.\n\n` +
    `If you did not initiate this request, you can safely ignore this email.`;

  const htmlBody = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px;background:#0d1117;color:#e6edf3;border-radius:12px;border:1px solid #30363d;">
      <h2 style="color:#00f5ff;margin-top:0;font-size:1.4rem;letter-spacing:0.04em;">Rudransh Srivastava — Portfolio</h2>
      <p style="font-size:1rem;color:#c9d1d9;line-height:1.5;">Hello <strong>${escapeHtml(toName || 'Visitor')}</strong>,</p>
      <p style="color:#8b949e;line-height:1.5;">You requested to send a message on my portfolio. To confirm access to this email mailbox, use the verification code below:</p>
      
      <div style="margin:28px 0;text-align:center;">
        <div style="display:inline-block;padding:16px 32px;background:#161b22;border:2px solid #00f5ff;border-radius:10px;font-size:2rem;font-weight:bold;letter-spacing:8px;color:#00f5ff;font-family:monospace;">
          ${otp}
        </div>
        <p style="font-size:0.85rem;color:#8b949e;margin-top:10px;">Valid for <strong>5 minutes</strong> (maximum 5 attempts)</p>
      </div>

      <div style="padding:14px;background:#161b22;border-left:4px solid #f59e0b;border-radius:4px;font-size:0.8rem;color:#8b949e;line-height:1.4;margin:24px 0;">
        <strong>Notice:</strong> This one-time passcode strictly verifies access to this email mailbox. It does not authenticate individual identity or trustworthiness.
      </div>

      <p style="font-size:0.8rem;color:#6e7681;margin-bottom:0;">
        If you did not request this message, no further action is required.
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject,
    text: textBody,
    html: htmlBody
  });
}

// Send Contact message notification to owner
export async function sendContactNotification(name, email, message) {
  const transporter = getTransporter();
  const ownerEmail = process.env.EMAIL_TO || process.env.EMAIL_USER;
  const fromAddress = `"${process.env.EMAIL_SENDER_NAME || 'Portfolio Contact'}" <${process.env.EMAIL_USER}>`;

  const subject = `[Verified Mailbox] Portfolio Contact from ${name}`;
  const textBody = `You have received a new contact message.\n\n` +
    `Mailbox Verification: VERIFIED (Access to ${email} was confirmed via OTP)\n` +
    `Name: ${name}\n` +
    `Email: ${email}\n\n` +
    `Message:\n${message}\n\n` +
    `Note: OTP verifies access to this email address at submission time.`;

  const htmlBody = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0d1117;color:#e6edf3;border-radius:10px;border:1px solid #30363d;">
      <h3 style="color:#00f5ff;margin-top:0;">New Verified Contact Message</h3>
      
      <div style="margin-bottom:16px;padding:8px 12px;background:rgba(16,185,129,0.15);border:1px solid #10b981;border-radius:6px;color:#10b981;font-size:0.85rem;display:inline-block;">
        ✓ Mailbox Access Verified via OTP
      </div>

      <p style="margin:8px 0;font-size:0.95rem;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:8px 0;font-size:0.95rem;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#00f5ff;">${escapeHtml(email)}</a></p>
      
      <div style="margin-top:16px;padding:16px;background:#161b22;border:1px solid #21262d;border-radius:8px;">
        <p style="margin:0 0 8px 0;color:#8b949e;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;"><strong>Message:</strong></p>
        <p style="margin:0;white-space:pre-wrap;color:#c9d1d9;font-size:0.95rem;line-height:1.6;">${escapeHtml(message)}</p>
      </div>

      <p style="font-size:0.75rem;color:#6e7681;margin-top:20px;border-top:1px solid #21262d;padding-top:12px;">
        Note: OTP confirms that the sender had access to this email mailbox when sending. It does not authenticate real-world identity.
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: fromAddress,
    to: ownerEmail,
    replyTo: email,
    subject,
    text: textBody,
    html: htmlBody
  });
}
