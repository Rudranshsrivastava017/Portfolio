import sendOtpHandler from '../api/send-otp.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { console.log('send-otp Response status:', this.statusCode, 'Data:', data); return this; },
    end() { return this; }
  };
}

async function test() {
  console.log('Testing send-otp with real email srivastavarudransh27@gmail.com...');
  const req = {
    method: 'POST',
    headers: {},
    body: {
      name: 'Rudransh',
      email: 'srivastavarudransh27@gmail.com'
    }
  };
  const res = createMockRes();
  await sendOtpHandler(req, res);
}

test();
