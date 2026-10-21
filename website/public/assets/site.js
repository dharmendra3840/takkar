// Takkar website script. Kept tiny: the page works without it (NFR-01).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function wireWaitlist() {
  const form = document.querySelector('.join__form');
  if (!form) return;
  const status = form.querySelector('.join__status');
  const button = form.querySelector('button[type="submit"]');

  const show = (message, kind) => {
    status.textContent = message;
    status.className = 'join__status join__status--' + kind;
  };

  // Shown after a no-JavaScript form post redirects back here.
  const result = new URLSearchParams(location.search).get('waitlist');
  if (result === 'ok') show('You are on the list. We will email you once, when Takkar opens.', 'ok');
  if (result === 'error') show('That did not go through. Check your email and the age box, then try again.', 'error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    if (!EMAIL_PATTERN.test(email)) {
      show('Please enter a valid email address.', 'error');
      form.email.focus();
      return;
    }
    if (!form.adult.checked) {
      show('Takkar is for people aged 18 and over. Please confirm your age.', 'error');
      form.adult.focus();
      return;
    }

    button.disabled = true;
    show('Saving…', 'ok');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, adult: true, website: form.website.value }),
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      show('You are on the list. We will email you once, when Takkar opens.', 'ok');
    } catch {
      show('We could not save that right now. Please try again in a minute.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

wireWaitlist();
