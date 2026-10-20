# dna4digital.com

Daniel Nowak's site: AI, GTM and process consulting. The landing page is a particle DNA helix with the menu on its rungs. Clicking a menu item zooms the camera onto that rung and opens the page beside it.

- **Astro** builds the pages to static HTML in `dist/`. Every page has its own URL and reads fine without JavaScript or WebGL.
- **three.js** draws the helix (`src/scripts/helix.ts`). It persists across page changes through Astro's `ClientRouter`.
- **A Cloudflare Worker** (`worker/index.ts`) handles one route, `POST /api/contact`, and emails the enquiry to dn@dna4digital.com. Everything else is served as static files.
- **Hosting:** Cloudflare Workers with static assets, deployed by Cloudflare from this GitHub repo.

## Working on it

```bash
npm install
npm run dev        # Astro dev server with hot reload (the contact form endpoint isn't available here)
npm run preview    # production build served by Wrangler, including the Worker and the _redirects/_headers rules
npm run check      # type-check the site and the Worker
```

Under `npm run preview` the contact form doesn't send real email. Wrangler prints the message in the terminal and saves it under `.wrangler/tmp/email/`.

### Where things live

| What | Where |
|---|---|
| Page copy | `src/pages/*.astro` |
| Menu items and which rung each page zooms to | `src/data/site.ts` |
| Styles | `src/styles/global.css` |
| Helix, background network, camera and page transitions | `src/scripts/helix.ts` |
| Contact form and AI readiness test behaviour | `src/scripts/forms.ts` |
| Blog posts | `src/content/blog/*.md` (copy `_example-post.md` to start one) |
| Old-URL redirects, security headers | `public/_redirects`, `public/_headers` |
| Cloudflare config (bindings, sender address, rate limit) | `wrangler.jsonc` |
| Snapshot of the old WordPress site | `reference/` (not deployed) |

## Cloudflare setup (one time)

### 1. Deploy from GitHub

Workers & Pages → Create → **Import a repository** → pick `dpn88/DNA4Digital`.

- Project name: `dna4digital` (must match `name` in `wrangler.jsonc`)
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Every push to `main` then builds and deploys. The site is live on `dna4digital.<your-subdomain>.workers.dev` until the domain is moved over (step 3).

### 2. Contact form email

The form sends from `website@forms.dna4digital.com` (`CONTACT_FROM`) to `dn@dna4digital.com` (`CONTACT_TO`).

1. Compute → Email Service → Email Routing → **Destination addresses**: add `dn@dna4digital.com` and click the link in the verification email.
2. Make `forms.dna4digital.com` a sending domain. Email to verified addresses is free on every plan.

> **Do not onboard the main domain `dna4digital.com` to Email Routing.** It replaces the MX records, and mail to your Google Workspace inbox would stop arriving. Use only the `forms.` subdomain.

To add the subdomain, try Email Routing → Settings → Subdomains → `forms.dna4digital.com`. If the dashboard wants Email Routing turned on for the main domain first, stop. Instead, onboard `forms.dna4digital.com` under Compute → Email Service → **Email Sending**. That needs the Workers Paid plan, and it only adds records to the subdomain.

To use a different sender address, change `CONTACT_FROM` in `wrangler.jsonc`.

### 3. Point dna4digital.com at the new site

Do this only after checking the workers.dev URL.

1. DNS → Records: write down, then delete, the `A`/`AAAA`/`CNAME` records for `dna4digital.com` and `www`. They point at Hostinger. **Leave the MX and TXT records alone**, because email depends on them.
2. Workers & Pages → `dna4digital` → Settings → Domains & Routes → Add → Custom domain: `dna4digital.com`, then again for `www.dna4digital.com`.

To roll back, remove the two custom domains and re-create the records you wrote down.

### Optional

- **Analytics:** Cloudflare Web Analytics is cookieless, so no consent banner is needed. The CSP in `public/_headers` already allows its script.
- **Spam:** if form spam gets past the hidden field, timing check and rate limit, add Cloudflare Turnstile.
