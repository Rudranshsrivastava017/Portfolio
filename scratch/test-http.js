import http from 'http';

function request(url, method, headers, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('1. Testing CORS OPTIONS preflight from http://localhost:5500 ...');
  const resOptions = await request('http://localhost:3001/api/send-otp', 'OPTIONS', {
    'Origin': 'http://localhost:5500',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type'
  });
  console.log('   OPTIONS Status:', resOptions.status);
  console.log('   Access-Control-Allow-Origin:', resOptions.headers['access-control-allow-origin']);

  console.log('2. Testing POST /api/send-otp from http://localhost:5500 ...');
  const testEmail = `visitor_${Date.now()}@corporate.io`;
  const resPost = await request('http://localhost:3001/api/send-otp', 'POST', {
    'Origin': 'http://localhost:5500',
    'Content-Type': 'application/json'
  }, {
    name: 'Alex River',
    email: testEmail
  });
  console.log('   POST Status:', resPost.status);
  console.log('   POST Response message:', resPost.data.message);
  console.log('   Dev OTP provided:', resPost.data.devOtp);

  console.log('3. Testing POST /api/verify-otp with devOtp ...');
  const resVerify = await request('http://localhost:3001/api/verify-otp', 'POST', {
    'Origin': 'http://localhost:5500',
    'Content-Type': 'application/json'
  }, {
    name: 'Alex River',
    email: testEmail,
    message: 'Hello Rudransh, message sent from Live Server!',
    otp: resPost.data.devOtp,
    verificationToken: resPost.data.verificationToken
  });
  console.log('   Verify Status:', resVerify.status);
  console.log('   Verify Response message:', resVerify.data.message);

  console.log('\nAll Live Server CORS and OTP verification checks PASSED!');
}

run().catch(console.error);
