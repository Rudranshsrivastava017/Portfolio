// ===== LOADER =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    triggerReveal();
  }, 2200);
});

// ===== CURSOR =====
const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX;my=e.clientY;
  dot.style.left=mx+'px';dot.style.top=my+'px';
});
function animateCursor(){
  rx+=(mx-rx)*0.12;ry+=(my-ry)*0.12;
  ring.style.left=rx+'px';ring.style.top=ry+'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();
document.querySelectorAll('a,button,.skill-card,.project-card,.achieve-card,.contact-link').forEach(el=>{
  el.addEventListener('mouseenter',()=>{
    ring.style.width='56px';ring.style.height='56px';ring.style.borderColor='var(--accent)';ring.style.opacity='0.4';
  });
  el.addEventListener('mouseleave',()=>{
    ring.style.width='36px';ring.style.height='36px';ring.style.borderColor='var(--accent)';ring.style.opacity='0.6';
  });
});

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let isDark = true;
themeToggle.addEventListener('click',()=>{
  isDark=!isDark;
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  themeIcon.className=isDark?'fas fa-moon':'fas fa-sun';
});

// ===== MOBILE MENU =====
document.getElementById('hamburger').addEventListener('click',()=>{
  document.getElementById('mobileMenu').classList.add('open');
});
document.getElementById('mobileClose').addEventListener('click',closeMobile);
function closeMobile(){document.getElementById('mobileMenu').classList.remove('open');}

// ===== SCROLL REVEAL =====
function triggerReveal(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('visible');
        // Animate skill bars
        const bar=e.target.querySelector('.skill-bar');
        if(bar){
          const w=bar.getAttribute('data-width');
          setTimeout(()=>bar.style.width=w+'%',200);
        }
      }
    });
  },{threshold:0.15});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}
// Also trigger for elements visible on load (hero section)
setTimeout(()=>{
  document.querySelectorAll('#hero .reveal').forEach(el=>el.classList.add('visible'));
},2300);

// ===== TYPING ANIMATION =====
const phrases = [
  'fast, modern web applications.',
  'user-friendly interfaces.',
  'solutions to hard problems.',
  'products that actually work.',
];
let pi=0,ci=0,deleting=false;
const tagline = document.querySelector('.hero-tagline');
const baseText='I build ';
function typeEffect(){
  const phrase=phrases[pi];
  if(!deleting){
    if(ci<=phrase.length){
      tagline.innerHTML=baseText+'<strong style="color:var(--accent)">'+phrase.slice(0,ci)+'</strong><span class="typing-cursor"></span>';
      ci++;setTimeout(typeEffect,60);
    }else{
      setTimeout(()=>{deleting=true;typeEffect();},2000);
    }
  }else{
    if(ci>=0){
      tagline.innerHTML=baseText+'<strong style="color:var(--accent)">'+phrase.slice(0,ci)+'</strong><span class="typing-cursor"></span>';
      ci--;setTimeout(typeEffect,35);
    }else{
      deleting=false;pi=(pi+1)%phrases.length;setTimeout(typeEffect,400);
    }
  }
}
setTimeout(typeEffect,2500);

// ===== CONTACT FORM =====
emailjs.init('YOUR_PUBLIC_KEY'); // replace with your EmailJS public key
function submitForm(){
  const name=document.getElementById('cf-name').value.trim();
  const email=document.getElementById('cf-email').value.trim();
  const msg=document.getElementById('cf-msg').value.trim();
  const status=document.getElementById('formStatus');
  if(!name||!email||!msg){
    status.textContent='⚠ Please fill in all fields.';
    status.style.color='var(--accent3)';
    return;
  }
  if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)){
    status.textContent='⚠ Please enter a valid email.';
    status.style.color='var(--accent3)';
    return;
  }
  status.textContent='⏳ Sending message...';
  status.style.color='var(--accent)';
  emailjs.send('YOUR_SERVICE_ID','YOUR_TEMPLATE_ID',{
    from_name: name,
    from_email: email,
    message: msg,
    reply_to: email
  })
  .then(() => {
    status.textContent='✓ Message sent! I will get back to you soon.';
    status.style.color='var(--accent)';
    document.getElementById('cf-name').value='';
    document.getElementById('cf-email').value='';
    document.getElementById('cf-msg').value='';
    setTimeout(()=>status.textContent='',5000);
  })
  .catch((error) => {
    console.error('EmailJS error:', error);
    status.textContent='⚠ Something went wrong. Please try again later.';
    status.style.color='var(--accent3)';
  });
}

// ===== RESUME DOWNLOAD =====
function downloadResume(){
  const a=document.createElement('a');
  a.href='mailto:srivastavarudransh27@gmail.com?subject=Resume Request';
  a.click();
}

// ===== NAV ACTIVE =====
const sections=document.querySelectorAll('section[id]');
const navLinks=document.querySelectorAll('.nav-links a');
window.addEventListener('scroll',()=>{
  let cur='';
  sections.forEach(s=>{if(window.scrollY>=s.offsetTop-100)cur=s.id;});
  navLinks.forEach(a=>{
    a.style.color=a.getAttribute('href')==='#'+cur?'var(--accent)':'';
  });
});