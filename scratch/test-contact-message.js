import { sendContactNotification } from '../api/utils/email.js';
import dotenv from 'dotenv';

dotenv.config({ override: true });

async function test() {
  console.log('Testing sendContactNotification...');
  console.log('Recipient (EMAIL_TO):', process.env.EMAIL_TO);

  try {
    const info = await sendContactNotification(
      'Acme Corp (John Doe)',
      'john.doe@acmecorp.com',
      'Hi Rudransh, we were impressed by your portfolio and would like to schedule an interview for a Frontend Developer role!'
    );
    console.log('✓ Contact message successfully sent to owner! Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Failed to send contact message:', err);
  }
}

test();
