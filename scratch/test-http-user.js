import http from 'http';

function post(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('Sending real OTP request to srivastavarudransh27@gmail.com...');
  const res = await post('http://localhost:3001/api/send-otp', {
    name: 'Rudransh Test',
    email: 'srivastavarudransh27@gmail.com'
  });
  console.log('Status:', res.status);
  console.log('Response:', res.data);
}

run();
