// Handles POST /api/contact and emails the enquiry to CONTACT_TO. Everything else is static assets.
// Works for plain HTML form posts (redirects back to the site) and for fetch() calls (JSON).

const TOPICS: Record<string, string> = {
  call: 'A free 30-min call',
  audit: 'AI readiness audit',
  gtm: 'GTM and process work',
  training: 'Training or workshop',
  consulting: 'Consulting and implementation',
  other: 'Something else',
};

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const MIN_FILL_MS = 3000;

type Fields = Record<'name' | 'email' | 'company' | 'topic' | 'message' | 'score' | 'lang', string>;

// Must match ROUTES.contact and ROUTES.thanks in src/i18n/index.ts.
const PAGES = {
  en: { contact: '/contact/', thanks: '/contact/thanks/' },
  pl: { contact: '/pl/kontakt/', thanks: '/pl/kontakt/dziekuje/' },
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });

  const wantsJson = (request.headers.get('Accept') ?? '').includes('application/json');
  // Plain form posts come from the contact page, so the referring page tells us which language to send them back to.
  const lang: 'en' | 'pl' = new URL(request.headers.get('Referer') ?? request.url).pathname.startsWith('/pl/') ? 'pl' : 'en';
  const pages = PAGES[lang];
  const reply = (status: 'sent' | 'invalid' | 'error' | 'busy', httpStatus: number) =>
    wantsJson
      ? Response.json({ ok: status === 'sent', status }, { status: httpStatus })
      : Response.redirect(new URL(status === 'sent' ? pages.thanks : `${pages.contact}?error=${status}`, request.url).toString(), 303);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.CONTACT_LIMIT) {
    const { success } = await env.CONTACT_LIMIT.limit({ key: `contact:${ip}` });
    if (!success) return reply('busy', 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply('invalid', 400);
  }

  // Bots fill the hidden field or submit faster than a person can type. Pretend it worked.
  const startedAt = Number(form.get('started') ?? 0);
  if (String(form.get('website') ?? '') !== '' || (startedAt > 0 && Date.now() - startedAt < MIN_FILL_MS)) return reply('sent', 200);

  const get = (key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);
  const f: Fields = {
    name: get('name', 120).replace(/[\r\n]+/g, ' '),
    email: get('email', 200),
    company: get('company', 160).replace(/[\r\n]+/g, ' '),
    topic: get('topic', 20),
    message: get('message', 5000),
    score: get('score', 3).replace(/\D/g, ''),
    lang: get('lang', 2) === 'pl' ? 'Polish' : 'English',
  };
  const consent = form.get('consent') === 'yes';
  if (!f.name || !EMAIL_RE.test(f.email) || f.message.length < 10 || !consent) return reply('invalid', 400);
  const topic = TOPICS[f.topic] ?? TOPICS.other;

  try {
    await env.EMAIL.send({
      from: { email: env.CONTACT_FROM, name: 'dna4digital.com' },
      to: env.CONTACT_TO,
      replyTo: { email: f.email, name: f.name },
      subject: `Website enquiry: ${topic} (${f.name})`,
      text: plainText(f, topic, ip),
      html: htmlBody(f, topic),
    });
  } catch (err) {
    console.error('contact: send failed', err);
    return reply('error', 502);
  }
  return reply('sent', 200);
}

function rows(f: Fields, topic: string): [string, string][] {
  const out: [string, string][] = [['Name', f.name], ['Email', f.email], ['Topic', topic], ['Site language', f.lang]];
  if (f.company) out.push(['Company', f.company]);
  if (f.score) out.push(['AI readiness score', `${f.score}/100`]);
  return out;
}

function plainText(f: Fields, topic: string, ip: string): string {
  return [...rows(f, topic).map(([k, v]) => `${k}: ${v}`), '', f.message, '', `Sent from the contact form on dna4digital.com (IP ${ip}). Reply to answer ${f.name} directly.`].join('\n');
}

function htmlBody(f: Fields, topic: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const table = rows(f, topic)
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#667"><b>${esc(k)}</b></td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join('');
  return `<div style="font:15px/1.55 system-ui,sans-serif;color:#111"><table>${table}</table><p style="white-space:pre-wrap;margin-top:16px">${esc(f.message)}</p><p style="color:#889;font-size:13px">Sent from the contact form on dna4digital.com. Reply to answer ${esc(f.name)} directly.</p></div>`;
}
