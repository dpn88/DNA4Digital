// Cloudflare Turnstile site key for the contact form's spam check. It's public, so it lives in the repo.
// Both the form (src/scripts/forms.ts) and the Worker read it: the widget only renders, and the Worker only enforces
// the check, once this is set. The matching secret goes on the Worker as TURNSTILE_SECRET. See README.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFnxI4-c4vYBBOoZ';
