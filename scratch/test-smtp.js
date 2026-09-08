import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ override: true });

console.log('Testing SMTP with credentials in .env:');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', (process.env.EMAIL_PASS || '').length);
console.log('EMAIL_TO:', process.env.EMAIL_TO);

const passClean = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false, // port 587 uses STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: passClean
  }
});

async function test() {
  console.log('\n1. Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('   ✓ SMTP connection and authentication SUCCESSFUL!');
  } catch (err) {
    console.error('   ❌ SMTP verify failed:', err.message);
    return;
  }

  console.log('\n2. Sending test email to', process.env.EMAIL_TO, '...');
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: 'Test Email from Portfolio Verification System',
      text: 'If you receive this email, your Gmail SMTP configuration is 100% working!'
    });
    console.log('   ✓ Test email sent successfully! Message ID:', info.messageId);
  } catch (err) {
    console.error('   ❌ Send mail failed:', err.message);
  }
}

test();
