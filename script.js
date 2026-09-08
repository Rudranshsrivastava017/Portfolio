// ===== LOADER =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    triggerReveal();
  }, 2200);
});

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let isDark = true;
themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeIcon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
});

// ===== MOBILE MENU =====
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.add('open');
});
document.getElementById('mobileClose').addEventListener('click', closeMobile);
function closeMobile() { document.getElementById('mobileMenu').classList.remove('open'); }

// ===== SCROLL REVEAL =====
function triggerReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        // Animate skill bars
        const bar = e.target.querySelector('.skill-bar');
        if (bar) {
          const w = bar.getAttribute('data-width');
          setTimeout(() => bar.style.width = w + '%', 200);
        }
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
// Also trigger for elements visible on load (hero section)
setTimeout(() => {
  document.querySelectorAll('#hero .reveal').forEach(el => el.classList.add('visible'));
}, 2300);

// ===== TYPING ANIMATION =====
const phrases = [
  'fast, modern web applications.',
  'user-friendly interfaces.',
  'solutions to hard problems.',
  'products that actually work.',
];
let pi = 0, ci = 0, deleting = false;
const tagline = document.querySelector('.hero-tagline');
const baseText = 'I build ';
function typeEffect() {
  const phrase = phrases[pi];
  if (!deleting) {
    if (ci <= phrase.length) {
      tagline.innerHTML = baseText + '<strong style="color:var(--accent)">' + phrase.slice(0, ci) + '</strong><span class="typing-cursor"></span>';
      ci++; setTimeout(typeEffect, 60);
    } else {
      setTimeout(() => { deleting = true; typeEffect(); }, 2000);
    }
  } else {
    if (ci >= 0) {
      tagline.innerHTML = baseText + '<strong style="color:var(--accent)">' + phrase.slice(0, ci) + '</strong><span class="typing-cursor"></span>';
      ci--; setTimeout(typeEffect, 35);
    } else {
      deleting = false; pi = (pi + 1) % phrases.length; setTimeout(typeEffect, 400);
    }
  }
}
setTimeout(typeEffect, 2500);

// ===== CONTACT FORM & SECURE OTP VERIFICATION =====
let currentVerificationToken = null;
let cooldownInterval = null;
let cooldownSecondsRemaining = 0;
let pendingContactData = { name: '', email: '', message: '' };

function validateContactInputs(name, email, msg, status) {
  if (!name || !email || !msg) {
    status.textContent = '⚠ Please fill in all fields.';
    status.style.color = 'var(--accent3)';
    return false;
  }
  // 1. Strict RFC email format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email) || email.includes('..') || email.includes('@.') || email.includes('.@')) {
    status.textContent = '⚠ Please enter a valid email address.';
    status.style.color = 'var(--accent3)';
    return false;
  }

  // 2. Extract domain and block disposable / fake email services
  const domain = email.split('@')[1].toLowerCase();
  const blockedDomains = [
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
  ];
  if (blockedDomains.includes(domain)) {
    status.textContent = '⚠ Temporary or fake email addresses are not allowed.';
    status.style.color = 'var(--accent3)';
    return false;
  }

  // 3. Check for common domain typos
  const typoDomains = {
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outloo.com': 'outlook.com'
  };
  if (typoDomains[domain]) {
    status.textContent = `⚠ Did you mean @${typoDomains[domain]}?`;
    status.style.color = 'var(--accent3)';
    return false;
  }

  return true;
}

function startCooldownTimer(seconds) {
  clearInterval(cooldownInterval);
  cooldownSecondsRemaining = seconds;
  const resendBtn = document.getElementById('cf-resend-btn');
  const cooldownSpan = document.getElementById('cf-cooldown');

  if (resendBtn) resendBtn.disabled = true;
  if (cooldownSpan) cooldownSpan.textContent = `(${cooldownSecondsRemaining}s)`;

  cooldownInterval = setInterval(() => {
    cooldownSecondsRemaining--;
    if (cooldownSecondsRemaining <= 0) {
      clearInterval(cooldownInterval);
      if (resendBtn) resendBtn.disabled = false;
      if (cooldownSpan) cooldownSpan.textContent = '';
    } else {
      if (cooldownSpan) cooldownSpan.textContent = `(${cooldownSecondsRemaining}s)`;
    }
  }, 1000);
}

function getApiUrl(endpoint) {
  // If viewing via Live Server (port 5500, etc.) or file://, forward API requests to the local dev server on port 3001
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  ) {
    if (window.location.port !== '3001') {
      return `http://localhost:3001${endpoint}`;
    }
  }
  return endpoint;
}

// Step 1: Request OTP
async function requestOtp() {
  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const msg = document.getElementById('cf-msg').value.trim();
  const status = document.getElementById('formStatus');
  const submitBtn = document.getElementById('cf-submit-btn');

  if (!validateContactInputs(name, email, msg, status)) {
    return;
  }

  pendingContactData = { name, email, message: msg };
  status.textContent = '⏳ Sending verification code...';
  status.style.color = 'var(--accent)';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(getApiUrl('/api/send-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send verification code.');
    }

    currentVerificationToken = data.verificationToken;

    // Switch view to OTP step
    document.getElementById('cf-step-details').style.display = 'none';
    const stepOtp = document.getElementById('cf-step-otp');
    stepOtp.style.display = 'block';

    const targetEmailEl = document.getElementById('cf-target-email');
    if (targetEmailEl) targetEmailEl.textContent = email;

    const otpInput = document.getElementById('cf-otp');
    if (otpInput) {
      otpInput.value = data.devOtp || '';
      otpInput.focus();
    }

    startCooldownTimer(data.cooldownSeconds || 60);

    status.textContent = '✓ ' + (data.message || 'Code sent. Please check your inbox.');
    status.style.color = 'var(--accent)';
    setTimeout(() => {
      if (status.textContent.startsWith('✓')) status.textContent = '';
    }, 6000);
  } catch (err) {
    console.error('send-otp error:', err);
    status.textContent = '⚠ ' + err.message;
    status.style.color = 'var(--accent3)';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Step 2: Verify OTP and send message
async function verifyAndSubmit() {
  const otpInput = document.getElementById('cf-otp');
  const otp = (otpInput?.value || '').trim();
  const status = document.getElementById('formStatus');
  const verifyBtn = document.getElementById('cf-verify-btn');

  if (!otp || otp.length < 6) {
    status.textContent = '⚠ Please enter the full 6-digit verification code.';
    status.style.color = 'var(--accent3)';
    return;
  }

  if (!currentVerificationToken) {
    status.textContent = '⚠ Session expired or missing. Please request a new code.';
    status.style.color = 'var(--accent3)';
    return;
  }

  status.textContent = '⏳ Verifying code and sending message...';
  status.style.color = 'var(--accent)';
  if (verifyBtn) verifyBtn.disabled = true;

  try {
    const res = await fetch(getApiUrl('/api/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pendingContactData.name,
        email: pendingContactData.email,
        message: pendingContactData.message,
        otp,
        verificationToken: currentVerificationToken
      })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Verification failed.');
    }

    status.textContent = data.message || '✓ Email verified! Message sent successfully.';
    status.style.color = 'var(--accent)';

    // Reset form
    document.getElementById('cf-name').value = '';
    document.getElementById('cf-email').value = '';
    document.getElementById('cf-msg').value = '';
    if (otpInput) otpInput.value = '';
    currentVerificationToken = null;
    pendingContactData = { name: '', email: '', message: '' };

    clearInterval(cooldownInterval);
    const cooldownSpan = document.getElementById('cf-cooldown');
    if (cooldownSpan) cooldownSpan.textContent = '';

    // Switch back to details view after success
    setTimeout(() => {
      document.getElementById('cf-step-otp').style.display = 'none';
      document.getElementById('cf-step-details').style.display = 'block';
    }, 2500);

    setTimeout(() => {
      status.textContent = '';
    }, 6000);
  } catch (err) {
    console.error('verify-otp error:', err);
    status.textContent = '⚠ ' + err.message;
    status.style.color = 'var(--accent3)';
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
  }
}

// Resend OTP
async function resendOtp() {
  if (cooldownSecondsRemaining > 0) return;
  const status = document.getElementById('formStatus');
  const resendBtn = document.getElementById('cf-resend-btn');

  status.textContent = '⏳ Resending verification code...';
  status.style.color = 'var(--accent)';
  if (resendBtn) resendBtn.disabled = true;

  try {
    const res = await fetch(getApiUrl('/api/send-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pendingContactData.name,
        email: pendingContactData.email
      })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to resend code.');
    }

    currentVerificationToken = data.verificationToken;
    const otpInput = document.getElementById('cf-otp');
    if (otpInput && data.devOtp) {
      otpInput.value = data.devOtp;
    }
    startCooldownTimer(data.cooldownSeconds || 60);

    status.textContent = '✓ ' + (data.message || 'A new verification code has been sent.');
    status.style.color = 'var(--accent)';
    setTimeout(() => {
      if (status.textContent.startsWith('✓')) status.textContent = '';
    }, 4000);
  } catch (err) {
    console.error('resend-otp error:', err);
    status.textContent = '⚠ ' + err.message;
    status.style.color = 'var(--accent3)';
  }
}

// Edit details / back button
function backToDetails() {
  document.getElementById('cf-step-otp').style.display = 'none';
  document.getElementById('cf-step-details').style.display = 'block';
  const status = document.getElementById('formStatus');
  if (status) status.textContent = '';
}

// Enter key support for OTP input
document.addEventListener('DOMContentLoaded', () => {
  const otpInput = document.getElementById('cf-otp');
  if (otpInput) {
    otpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyAndSubmit();
      }
    });
    // Auto-filter non-numeric characters
    otpInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }
});

// Alias for compatibility and global window bindings
function submitForm() {
  requestOtp();
}
window.requestOtp = requestOtp;
window.verifyAndSubmit = verifyAndSubmit;
window.resendOtp = resendOtp;
window.backToDetails = backToDetails;
window.submitForm = submitForm;

// ===== RESUME DOWNLOAD =====
function downloadResume() {
  const a = document.createElement('a');
  a.href = 'resume.pdf';
  a.download = 'Rudransh_Srivastava_Resume.pdf';
  a.target = '_blank';
  a.click();
}

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let cur = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) cur = s.id; });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--accent)' : '';
  });
});