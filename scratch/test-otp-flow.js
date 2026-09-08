import assert from 'assert';
import {
  validateEmailInput,
  createVerificationToken,
  verifyTokenAndOtp,
  hashOtp,
  checkCooldown,
  recordSentOtp,
  generateSecureOtp,
  MAX_ATTEMPTS
} from '../api/utils/email.js';
import sendOtpHandler from '../api/send-otp.js';
import verifyOtpHandler from '../api/verify-otp.js';

console.log('🧪 Starting Security and Flow Unit Tests...\n');

// 1. Test Email Validation
console.log('1. Testing Email Validation...');
assert.strictEqual(validateEmailInput('test@example.com').valid, false, 'Should block example.com');
assert.strictEqual(validateEmailInput('user@mailinator.com').valid, false, 'Should block disposable email');
assert.strictEqual(validateEmailInput('user@gmai.com').valid, false, 'Should flag gmai.com typo');
assert.strictEqual(validateEmailInput('invalid-email').valid, false, 'Should reject invalid format');
assert.strictEqual(validateEmailInput('user@domain.co.in').valid, true, 'Should accept valid email');
console.log('   ✓ Email validation checks passed.');

// 2. Test OTP Generation & Hashing
console.log('2. Testing OTP Generation & Hashing...');
const otp = generateSecureOtp();
assert.strictEqual(otp.length, 6, 'OTP must be 6 digits');
assert.match(otp, /^[0-9]{6}$/, 'OTP must be numeric');
const now = Date.now();
const hash1 = hashOtp('User@Test.com', otp, now);
const hash2 = hashOtp('user@test.com', otp, now);
assert.strictEqual(hash1, hash2, 'Hash must be case-insensitive for email');
console.log('   ✓ OTP generation & HMAC hashing passed.');

// 3. Test Token Creation & Verification
console.log('3. Testing Cryptographic Token Verification...');
const testEmail = 'visitor@testcompany.org';
const testOtp = '482910';
const expiresAt = Date.now() + 5 * 60 * 1000;
const token = createVerificationToken(testEmail, testOtp, expiresAt);

assert(typeof token === 'string' && token.includes('.'), 'Token must be a signed dot-separated string');
assert(!token.includes(testOtp), 'Token must NEVER contain plain-text OTP');

// Test wrong OTP
const wrongRes = verifyTokenAndOtp(token, testEmail, '000000');
assert.strictEqual(wrongRes.valid, false, 'Wrong OTP must be rejected');
console.log('   ✓ Incorrect OTP was successfully rejected.');

// Test correct OTP
const correctRes = verifyTokenAndOtp(token, testEmail, testOtp);
assert.strictEqual(correctRes.valid, true, 'Correct OTP must be accepted');
console.log('   ✓ Valid OTP was successfully accepted.');

// Test Replay Attack
const replayRes = verifyTokenAndOtp(token, testEmail, testOtp);
assert.strictEqual(replayRes.valid, false, 'Replayed token must be rejected');
console.log('   ✓ Replay protection verified.');

// 4. Test Maximum Attempts Lockout
console.log('4. Testing Maximum Attempts Enforcement (5 attempts)...');
const testOtp2 = '987654';
const token2 = createVerificationToken('user2@testcompany.org', testOtp2, Date.now() + 300000);

for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  const res = verifyTokenAndOtp(token2, 'user2@testcompany.org', '111111');
  assert.strictEqual(res.valid, false);
}
// 6th attempt should fail with max attempts exceeded
const lockRes = verifyTokenAndOtp(token2, 'user2@testcompany.org', testOtp2);
assert.strictEqual(lockRes.valid, false);
assert(lockRes.message.includes('Maximum verification attempts exceeded'), 'Must report max attempts exceeded');
console.log('   ✓ 5-attempt limit and lockout verified.');

// 5. Test Expiry
console.log('5. Testing 5-minute Expiry Enforcement...');
const expiredToken = createVerificationToken('user3@test.com', '123456', Date.now() - 1000);
const expRes = verifyTokenAndOtp(expiredToken, 'user3@test.com', '123456');
assert.strictEqual(expRes.valid, false);
assert(expRes.message.includes('expired'), 'Must report token expired');
console.log('   ✓ Token expiration verified.');

// 6. Test Token Tampering
console.log('6. Testing Tamper Protection...');
const validToken = createVerificationToken('user4@test.com', '654321', Date.now() + 300000);
const tamperedToken = validToken.slice(0, -4) + 'abcd';
const tamperRes = verifyTokenAndOtp(tamperedToken, 'user4@test.com', '654321');
assert.strictEqual(tamperRes.valid, false);
assert(tamperRes.message.includes('tampered'), 'Must detect tampered signature');
console.log('   ✓ Cryptographic signature tampering detection verified.');

// 7. Test Cooldown
console.log('7. Testing 60-Second Cooldown...');
recordSentOtp('cooldown@test.com');
const cd1 = checkCooldown('cooldown@test.com');
assert.strictEqual(cd1.allowed, false, 'Should be on cooldown');
console.log('   ✓ 60-second cooldown verified.');

// Helper for Mock HTTP response
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}

// 8. Test API Route: send-otp & verify-otp integration
console.log('8. Testing API Route Handlers...');
async function testApiRoutes() {
  // send-otp
  const sendReq = {
    method: 'POST',
    headers: {},
    body: { name: 'Test Visitor', email: 'visitor.test@myorg.io' }
  };
  const sendRes = createMockRes();
  await sendOtpHandler(sendReq, sendRes);

  assert.strictEqual(sendRes.statusCode, 200);
  assert(sendRes.body.success, 'send-otp must return success: true');
  assert(sendRes.body.verificationToken, 'send-otp must return verificationToken');
  const returnedToken = sendRes.body.verificationToken;

  // Immediate resend should fail with 429
  const sendReq2 = {
    method: 'POST',
    headers: {},
    body: { name: 'Test Visitor', email: 'visitor.test@myorg.io' }
  };
  const sendRes2 = createMockRes();
  await sendOtpHandler(sendReq2, sendRes2);
  assert.strictEqual(sendRes2.statusCode, 429, 'Immediate resend must return 429 Cooldown');
  console.log('   ✓ send-otp route and 429 cooldown verified.');

  // Attempt bypass without valid OTP: send-message cannot be bypassed
  const bypassReq = {
    method: 'POST',
    headers: {},
    body: {
      name: 'Test Visitor',
      email: 'visitor.test@myorg.io',
      message: 'Hacked message',
      verified: true // trying to spoof!
    }
  };
  const bypassRes = createMockRes();
  await verifyOtpHandler(bypassReq, bypassRes);
  assert.strictEqual(bypassRes.statusCode, 400, 'Bypass attempt without OTP must be rejected');
  console.log('   ✓ Spoof bypass prevention verified.');

  console.log('\n🎉 ALL SECURITY AND UNIT TESTS PASSED SUCCESSFULLY!\n');
}

testApiRoutes();
