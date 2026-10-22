// Page widgets that need JS: the contact form (sent with fetch, posts normally without JS) and the AI readiness test.
// Both bind on every astro:page-load because pages are swapped in without a full reload, and both follow <html lang>.
import { navigate } from 'astro:transitions/client';
import { CONTACT_EMAIL } from '../data/site';
import { ROUTES, type Lang } from '../i18n';

const pageLang = (): Lang => (document.documentElement.lang === 'pl' ? 'pl' : 'en');

const FORM_TEXT = {
  en: {
    sending: 'Sending...',
    scorePrefill: (s: string) => `I took the AI readiness test and scored ${s}/100. `,
    errors: {
      invalid: 'Please fill in your name, a valid email and a short message, and tick the privacy consent.',
      busy: 'Too many messages in a short time. Please wait a minute and try again.',
      error: `The message didn't go through. Please email ${CONTACT_EMAIL} instead.`,
    } as Record<string, string>,
  },
  pl: {
    sending: 'Wysyłanie...',
    scorePrefill: (s: string) => `Mój wynik w teście gotowości AI: ${s}/100. `,
    errors: {
      invalid: 'Podaj imię, poprawny adres e-mail i krótką wiadomość oraz zaznacz zgodę na przetwarzanie danych.',
      busy: 'Za dużo wiadomości w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
      error: `Wiadomość nie dotarła. Napisz bezpośrednio na ${CONTACT_EMAIL}.`,
    } as Record<string, string>,
  },
};

function initContact() {
  const form = document.querySelector<HTMLFormElement>('form[data-contact]');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  const lang = pageLang();
  const text = FORM_TEXT[lang];
  const status = form.querySelector<HTMLElement>('.form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const field = <T extends Element>(name: string) => form.elements.namedItem(name) as T | null;

  const params = new URLSearchParams(location.search);
  const topic = params.get('topic');
  const topicSelect = field<HTMLSelectElement>('topic');
  if (topic && topicSelect && [...topicSelect.options].some(o => o.value === topic)) topicSelect.value = topic;
  const score = params.get('score');
  if (score && /^\d{1,3}$/.test(score)) {
    field<HTMLInputElement>('score')!.value = score;
    const message = field<HTMLTextAreaElement>('message')!;
    if (!message.value) message.value = text.scorePrefill(score);
  }
  const error = params.get('error');
  if (error) showStatus(text.errors[error] ?? text.errors.error, true);
  field<HTMLInputElement>('started')!.value = String(Date.now());

  function showStatus(message: string, isError: boolean) {
    status.textContent = message;
    status.className = `form-status ${isError ? 'err' : 'ok'}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    showStatus(text.sending, false);
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
      if (res.ok && data.ok) {
        navigate(ROUTES.thanks[lang]);
        return;
      }
      showStatus(text.errors[data.status ?? ''] ?? text.errors.error, true);
    } catch {
      showStatus(text.errors.error, true);
    }
    button.disabled = false;
  });
}

// ---------- AI readiness test ----------
type Result = { max: number; title: string; text: string; recs: string[] };
const QUIZ: Record<Lang, { questions: { q: string; a: string[] }[]; results: Result[]; ui: Record<string, string> }> = {
  en: {
    ui: { count: 'Question {n} of {total}', back: 'Previous question', yourScore: 'Your AI readiness score', start: 'Where I would start', cta: "Let's talk about your score", restart: 'Start over' },
    questions: [
      { q: 'Where does your customer and sales data live today?', a: ["Mostly in emails, notes and our salespeople's heads.", "In a few spreadsheets and tools nobody has connected.", 'In a CRM and a few other systems, but we still build the board report by hand.', 'In one connected system, and the reports refresh themselves.'] },
      { q: 'How does your team use AI today?', a: ["It doesn't yet.", 'A few people use AI chat tools on their own.', 'We have data people who build their own solutions.', 'We have a team that brings AI into our processes.'] },
      { q: 'What does your company base sales and operations decisions on?', a: ['Gut feel and experience.', 'Gut feel that we check against simple reports.', 'Data we analyse regularly.', 'Data and forecasts the leadership team trusts.'] },
      { q: 'How do new tools arrive in your company?', a: ['Only when the old ones stop coping.', 'After a long round of comparisons and tests.', 'Quickly, if a tool has worked for others.', "We're among the first to test new things."] },
      { q: 'How much of the work in your processes do people do by hand?', a: ['We do almost everything by hand.', 'We have a few automations, but we still copy a lot of data across by hand.', 'The main processes run automatically, with a few gaps.', 'Only the exceptions are left to do by hand.'] },
      { q: 'What does your budget for tools and improvements look like?', a: ["There isn't one yet.", 'There is one, but every cost has to pay back fast.', "We've set money aside for a few larger projects.", 'We can also afford experiments that might fail.'] },
      { q: 'When your company changes how it works, the team usually…', a: ['resists and slips back into old habits.', "accepts the change once there's no way round it.", 'gets training and someone who keeps the rollout on track.', 'suggests the next changes itself.'] },
      { q: 'Your main goal for the next two to three years:', a: ['Hold on to what we have.', 'Grow steadily and run more efficiently.', 'Grow significantly and enter new markets.', 'Become the leader in our industry.'] },
    ],
    results: [
      { max: 39, title: 'Basics first', text: "You'll gain most by sorting out the basics before you buy any AI tool.", recs: ['Map how your core processes run today, and write down who owns each step', 'Get your key data into one place and agree what the main terms mean', 'Run a small, low-risk pilot on one repetitive task', 'Give leadership a short, practical grounding in what AI can and cannot do'] },
      { max: 69, title: 'Time for pilots', text: "You have the basics. Your biggest risk at this stage is automating processes nobody has tidied up yet.", recs: ['Rank the problems in your processes by what they cost you', 'Fix the handoffs and definitions before you automate them', 'Run two or three pilots, and give each one a single number that tells you it worked', 'Train the people who will run the new workflows, on your own data'] },
      { max: 100, title: 'Time for more teams', text: 'Your company is well prepared. Now the job is to extend what already works to more teams without losing control of it.', recs: ['Scale the pilots that proved their value across teams', 'Put governance in place: policies, ownership and audit trails', 'Look for custom solutions where off-the-shelf tools fall short', 'Measure how many people use the tools you have rolled out'] },
    ],
  },
  pl: {
    ui: { count: 'Pytanie {n} z {total}', back: 'Poprzednie pytanie', yourScore: 'Twój wynik gotowości na AI', start: 'Od czego bym zaczął', cta: 'Porozmawiajmy o wyniku', restart: 'Zacznij od nowa' },
    questions: [
      { q: 'Gdzie dziś są Twoje dane o klientach i sprzedaży?', a: ['Głównie w mailach, notatkach i głowach handlowców.', 'W kilku arkuszach i narzędziach, których nikt ze sobą nie połączył.', 'W CRM i kilku systemach, ale raport dla zarządu i tak składamy ręcznie.', 'W jednym połączonym systemie, a raporty odświeżają się same.'] },
      { q: 'Jak Twój zespół korzysta dziś z AI?', a: ['Jeszcze nie korzysta.', 'Kilka osób używa czatów AI na własną rękę.', 'Mamy osoby od danych, które budują własne rozwiązania.', 'Mamy zespół, który wdraża AI w procesach firmy.'] },
      { q: 'Na czym Twoja firma opiera decyzje w sprzedaży i operacjach?', a: ['Na wyczuciu i doświadczeniu.', 'Na wyczuciu, które sprawdzamy w prostych raportach.', 'Na danych, które regularnie analizujemy.', 'Na danych i prognozach, którym zarząd ufa.'] },
      { q: 'Jak w Twojej firmie pojawiają się nowe narzędzia?', a: ['Dopiero wtedy, kiedy stare przestają wystarczać.', 'Po długim porównywaniu i testach.', 'Szybko, jeśli narzędzie sprawdziło się u innych.', 'Testujemy nowości jako jedni z pierwszych.'] },
      { q: 'Ile pracy w Twoich procesach ludzie wykonują ręcznie?', a: ['Prawie wszystko robimy ręcznie.', 'Mamy kilka automatyzacji, ale wiele danych wciąż przeklejamy ręcznie.', 'Najważniejsze procesy działają automatycznie, z kilkoma dziurami.', 'Ręcznie zostały tylko wyjątki.'] },
      { q: 'Jak wygląda Twój budżet na narzędzia i usprawnienia?', a: ['Na razie go nie ma.', 'Jest, ale każdy wydatek musi się szybko zwrócić.', 'Mamy wydzielone pieniądze na kilka większych projektów.', 'Stać nas też na eksperymenty, które mogą się nie udać.'] },
      { q: 'Kiedy Twoja firma zmienia sposób pracy, zespół zwykle…', a: ['stawia opór i wraca do starych nawyków.', 'przyjmuje zmianę, kiedy nie ma wyjścia.', 'dostaje szkolenie i kogoś, kto pilnuje wdrożenia.', 'sam proponuje kolejne zmiany.'] },
      { q: 'Twój główny cel na najbliższe dwa, trzy lata:', a: ['Utrzymać to, co mamy.', 'Rosnąć stabilnie i działać sprawniej.', 'Wyraźnie urosnąć i wejść na nowe rynki.', 'Zostać liderem w swojej branży.'] },
    ],
    results: [
      { max: 39, title: 'Najpierw podstawy', text: 'Najwięcej zyskasz, jeśli uporządkujesz podstawy, zanim kupisz jakiekolwiek narzędzie AI.', recs: ['Opisz, jak dziś działają Twoje kluczowe procesy i kto odpowiada za każdy krok', 'Zbierz najważniejsze dane w jednym miejscu i uzgodnij, co znaczą kluczowe pojęcia', 'Uruchom mały, bezpieczny pilotaż na jednym powtarzalnym zadaniu', 'Daj zarządowi krótkie, praktyczne wprowadzenie: co AI potrafi, a czego nie'] },
      { max: 69, title: 'Czas na pilotaże', text: 'Podstawy masz. Największe ryzyko na tym etapie to automatyzacja procesów, których nikt jeszcze nie uporządkował.', recs: ['Ułóż problemy w procesach według tego, ile Cię kosztują', 'Popraw przekazywanie pracy i definicje, zanim je zautomatyzujesz', 'Uruchom dwa, trzy pilotaże i dla każdego ustal jedną liczbę, po której poznasz, że się udał', 'Przeszkol osoby, które będą prowadzić nowe procesy, na Twoich własnych danych'] },
      { max: 100, title: 'Czas na kolejne zespoły', text: 'Twoja firma jest dobrze przygotowana. Teraz chodzi o to, żeby rozszerzyć na kolejne zespoły to, co już działa, i nie stracić nad tym kontroli.', recs: ['Skaluj pilotaże, które się sprawdziły, na kolejne zespoły', 'Wprowadź zasady: polityki, odpowiedzialność i ścieżki audytu', 'Szukaj rozwiązań szytych na miarę tam, gdzie gotowe narzędzia nie wystarczają', 'Mierz, ile osób korzysta z wdrożonych narzędzi'] },
    ],
  },
};

function initQuiz() {
  const found = document.querySelector<HTMLElement>('[data-quiz]');
  if (!found || found.dataset.bound) return;
  const box = found;
  box.dataset.bound = '1';
  const lang = pageLang();
  const { questions, results, ui } = QUIZ[lang];
  const answers: number[] = [];
  const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function renderQuestion(moveFocus = true) {
    const i = answers.length;
    const pct = Math.round((i / questions.length) * 100);
    box.innerHTML = `
      <div class="count">${ui.count.replace('{n}', String(i + 1)).replace('{total}', String(questions.length))}</div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <fieldset>
        <legend>${esc(questions[i].q)}</legend>
        ${questions[i].a.map((a, v) => `<button type="button" class="opt" data-v="${v + 1}">${esc(a)}</button>`).join('')}
      </fieldset>
      <div class="nav">${i > 0 ? `<button type="button" class="linkbtn" data-back>&larr; ${ui.back}</button>` : '<span></span>'}</div>`;
    box.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => b.addEventListener('click', () => {
      answers.push(Number(b.dataset.v));
      answers.length === questions.length ? renderResult() : renderQuestion();
    }));
    box.querySelector('[data-back]')?.addEventListener('click', () => { answers.pop(); renderQuestion(); });
    if (moveFocus) box.querySelector<HTMLButtonElement>('.opt')?.focus({ preventScroll: true });
  }

  function renderResult() {
    const score = Math.round((answers.reduce((s, v) => s + v, 0) / (questions.length * 4)) * 100);
    const r = results.find(x => score <= x.max)!;
    box.innerHTML = `
      <div class="result" tabindex="-1">
        <div class="count">${ui.yourScore}</div>
        <div class="score">${score}<span style="font-size:24px;color:var(--muted)">/100</span></div>
        <h2>${r.title}</h2>
        <p>${r.text}</p>
        <h3>${ui.start}</h3>
        <ul class="ticks">${r.recs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="btnrow">
          <a class="btn btn-primary" href="${ROUTES.contact[lang]}?topic=audit&amp;score=${score}">${ui.cta}</a>
          <button type="button" class="btn btn-ghost" data-restart>${ui.restart}</button>
        </div>
      </div>`;
    box.querySelector('[data-restart]')!.addEventListener('click', () => { answers.length = 0; renderQuestion(); });
    box.querySelector<HTMLElement>('.result')!.focus({ preventScroll: true });
  }

  renderQuestion(false);
}

document.addEventListener('astro:page-load', () => {
  initContact();
  initQuiz();
});
