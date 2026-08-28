# Feature Spec: Email Notification on Contact Form Submission

**Project:** Portfolio (static HTML/CSS/JS)
**Feature:** When a visitor submits the "Send a Message" form, you get notified by email instantly.
**Chosen approach:** EmailJS (client-side only, no backend needed)
**Status:** Mostly implemented — needs configuration, not new architecture.

---

## 1. Current State (from your form + notes)

Your "Let's Connect" section has a form with:

| Field | Element (per your notes) |
|---|---|
| Your Name | `#cf-name` |
| Email Address | `#cf-email` |
| Message | `#cf-msg` |
| Submit button | "Send Message" → calls `submitForm()` |

`index.html` already loads an EmailJS SDK script tag, and `script.js` already contains an `emailjs.init(...)` call and an `emailjs.send(...)` call inside `submitForm()`, using placeholder IDs (`YOUR_SERVICE_ID`, `YOUR_TEMPLATE_ID`, `YOUR_PUBLIC_KEY`).

**This means:** you don't need a new backend, database, or server. You need to (a) create real EmailJS credentials, (b) drop them into the existing placeholders, and (c) make sure the SDK version and init syntax match EmailJS's current API.

---

## 2. Target Flow

```
Visitor fills form (Name, Email, Message)
        │
        ▼
Clicks "Send Message"
        │
        ▼
script.js → emailjs.send(serviceID, templateID, {from_name, from_email, message, reply_to})
        │
        ▼
EmailJS relays it through your connected Gmail account
        │
        ▼
You receive an email in your inbox → you can hit "Reply" and it goes to the visitor
```

No server, no database, works on your current Vercel deployment.

---

## 3. Step-by-Step Setup

### Step 1 — Create your EmailJS account
Go to emailjs.com and sign up.

### Step 2 — Add an Email Service
Dashboard → **Email Services** → **Add New Service** → choose **Gmail** → connect `srivastavarudransh27@gmail.com`.
You'll get a **Service ID** like `service_xxxxxxx`.

### Step 3 — Create an Email Template
Dashboard → **Email Templates** → **Create New Template**. Set it up like this:

- **Subject:** `New Portfolio Contact - {{from_name}}`
- **To Email:** `srivastavarudransh27@gmail.com`
- **Reply To:** `{{reply_to}}`
- **Body:**
  ```
  You have received a new message from your portfolio.

  Name: {{from_name}}
  Email: {{from_email}}

  Message:
  {{message}}
  ```

You'll get a **Template ID** like `template_abc123`. The variable names (`from_name`, `from_email`, `message`, `reply_to`) must match exactly what `script.js` sends — see Step 5.

### Step 4 — Get your Public Key
Dashboard → **Account** → **General** → copy your **Public Key**.

### Step 5 — Update your code

**In `index.html`**, replace the old SDK tag with the current one:

```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
```

**In `script.js`**, initialize with the current object-based syntax (not the old string-only version):

```js
emailjs.init({
  publicKey: "YOUR_ACTUAL_PUBLIC_KEY",
});
```

Then in your `submitForm()` function, send using your real IDs:

```js
function submitForm(e) {
  e.preventDefault();

  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const msg = document.getElementById('cf-msg').value.trim();

  emailjs.send(
    "YOUR_ACTUAL_SERVICE_ID",
    "YOUR_ACTUAL_TEMPLATE_ID",
    {
      from_name: name,
      from_email: email,
      message: msg,
      reply_to: email,
    }
  ).then(
    () => {
      // show your existing "Message sent!" success UI here
      document.getElementById('cf-form').reset();
    },
    (err) => {
      console.error('EmailJS error:', err);
      // show your existing error UI here
    }
  );
}
```

> Swap `YOUR_ACTUAL_SERVICE_ID`, `YOUR_ACTUAL_TEMPLATE_ID`, and the public key for the real values from Steps 2–4.

**Alternative (less code):** use `emailjs.sendForm()` instead of `emailjs.send()` — it reads all fields directly from the `<form>` element by their `name` attributes, so you don't have to manually pull each field's value. Only worth switching to if you're comfortable adding `name="from_name"` etc. to your inputs; otherwise your current manual approach is fine.

---

## 4. Testing Checklist

- [ ] Open the portfolio locally (or on Vercel preview)
- [ ] Fill in Name, Email, Message with test data
- [ ] Click "Send Message" and confirm the success message shows
- [ ] Check `srivastavarudransh27@gmail.com` inbox (and **Spam folder**) for the email
- [ ] Confirm hitting "Reply" in Gmail addresses the visitor's email, not EmailJS
- [ ] Submit with an empty field and confirm your existing validation blocks it
- [ ] Open browser DevTools console and confirm no errors on submit

---

## 5. Limits & Spam Protection (worth knowing before launch)

- EmailJS's **free plan** allows **200 email requests/month** and **2 templates** — plenty for a portfolio, but worth knowing if the form ever gets hit heavily.
- Because the public key is visible in your client-side JS (this is expected/normal for EmailJS), anyone could technically script requests against your service. To reduce spam:
  - Enable **reCAPTCHA** in EmailJS's template settings (built-in support), or
  - Add a simple **honeypot field** (a hidden input that bots fill in but humans don't; if it has a value, silently reject the submission before calling `emailjs.send`).
- EmailJS also supports a `blockList` option in the send call to reject specific emails/values if spam becomes an issue.

---

## 6. Deploy

```bash
git add .
git commit -m "Wire up EmailJS contact form notifications"
git push
```

Vercel redeploys automatically from your existing setup.

---

## 7. What I'd Need From You to Go Further

If you want me to directly edit your actual `index.html` / `script.js` (rather than you copy-pasting from this spec), upload those three files here and I'll make the exact edits in place.
