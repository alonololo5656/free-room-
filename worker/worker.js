// Telegram bot for the site owner, on Cloudflare Workers (see README → "בוט בטלגרם").
// - You chat with it in Hebrew; Claude answers using the tools below (who's online, claims, cancelling claims).
// - Every 15 minutes it enforces the claim limit and messages you about anything unusual.
// Secrets (wrangler secret put): TELEGRAM_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET, ANTHROPIC_API_KEY, FIREBASE_SA
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { MAX_PER_DAY, flatten, overLimit, suspiciousNames } from '../bot.mjs';

const DB_URL = 'https://free-room-4c651-default-rtdb.europe-west1.firebasedatabase.app';
const SITE = 'https://alonololo5656.github.io/free-room-';
const today = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' });
const dbKey = s => encodeURIComponent(String(s).replace(/[.#$\[\]\/]/g, '_'));

// ---------- Firebase as admin (service account key → short-lived Google token; bypasses the rules) ----------
let token;
async function adminToken(env) {
  if (token?.exp > Date.now() + 60e3) return token.value;
  const sa = JSON.parse(env.FIREBASE_SA);
  const b64 = s => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email' }));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${b64(String.fromCharCode(...sig))}` });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Google token: ${JSON.stringify(j)}`);
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}
async function db(env, path, method = 'GET', body) {
  const res = await fetch(`${DB_URL}/${path}.json?access_token=${await adminToken(env)}`,
    { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(`db ${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------- Telegram ----------
const tg = (env, method, body) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`,
  { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const send = (env, chat_id, text) => tg(env, 'sendMessage', { chat_id, text: text.slice(0, 4000) });

// ---------- what Claude can do ----------
const tools = env => [
  betaTool({
    name: 'list_online',
    description: 'מי נמצא באתר עכשיו (לפי שם, אם הגדיר), וכמה מכשירים נכנסו היום ובסך הכול. מכשיר בלי שם עוד לא תפס כיתה אף פעם.',
    inputSchema: { type: 'object', properties: { minutes: { type: 'integer', description: 'כמה דקות אחורה נחשב "מחובר". ברירת מחדל 3' } }, additionalProperties: false },
    run: async ({ minutes = 3 }) => {
      const all = Object.values(await db(env, 'online') || {});
      const since = Date.now() - minutes * 60e3, day = at => new Date(at).toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' });
      const now = all.filter(u => u.at > since).sort((a, b) => b.at - a.at);
      return JSON.stringify({
        online_now: now.length,
        names_now: now.map(u => u.by || 'בלי שם'),
        devices_today: all.filter(u => day(u.at) === today()).length,
        devices_ever: all.length });
    },
  }),
  betaTool({
    name: 'list_claims',
    description: 'כל התפיסות של יום מסוים: שעה, חדר, שם, מזהה מכשיר.',
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'], additionalProperties: false },
    run: async ({ date }) => JSON.stringify(flatten(await db(env, `claims/${dbKey(date)}`))
      .map(({ hour, room, by, id }) => ({ hour, room, by, device: id }))),
  }),
  betaTool({
    name: 'cancel_claims',
    description: 'ביטול תפיסות. קודם קרא ל-list_claims כדי לדעת שעה וחדר מדויקים.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['date', 'claims'], properties: {
      date: { type: 'string', description: 'YYYY-MM-DD' },
      claims: { type: 'array', items: { type: 'object', required: ['hour', 'room'], additionalProperties: false,
        properties: { hour: { type: 'string' }, room: { type: 'string', description: 'שם החדר בדיוק כמו ב-list_claims' } } } } } },
    run: async ({ date, claims }) => {
      for (const c of claims) await db(env, `claims/${dbKey(date)}/${dbKey(c.hour)}/${dbKey(c.room)}`, 'DELETE');
      return `בוטלו ${claims.length} תפיסות`;
    },
  }),
];

async function ask(env, text) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const final = await client.beta.messages.toolRunner({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if the model declines, the API retries on a fallback model
    max_iterations: 8,
    system: `אתה העוזר של מנהל האתר "כיתה פנויה" בבית ספר בליך. תלמידים "תופסים" באתר כיתות פנויות לשעה מסוימת, עד ${MAX_PER_DAY} ביום לאדם.
היום ${today()} (שעון ישראל). ענה בעברית, קצר וברור, כמו הודעת טלגרם.
אפשר לעשות רק מה שהכלים מאפשרים: לראות מי מחובר, לראות תפיסות ולבטל תפיסות. אם מבקשים משהו אחר, תגיד שאין לך את זה עדיין.
לפני ביטול של יותר מ-5 תפיסות, תאשר עם המנהל מה בדיוק יבוטל, אלא אם הוא כבר ביקש במפורש.`,
    tools: tools(env),
    messages: [{ role: 'user', content: text }],
  });
  if (final.stop_reason === 'refusal') return 'לא יכול לעזור בזה.';
  return final.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'בוצע.';
}

// ---------- watchdog (cron) ----------
async function watchdog(env) {
  const data = await fetch(`${SITE}/data.json`, { cache: 'no-store' }).then(r => r.json());
  const sent = await db(env, 'bot/sent') || {};
  const once = async (key, text) => { // the same problem is reported once, not every 15 min
    if (sent[dbKey(key)]) return;
    await send(env, env.OWNER_CHAT_ID, text);
    await db(env, `bot/sent/${dbKey(key)}`, 'PUT', Date.now());
  };

  for (const date of Object.keys(data.days).filter(d => d >= today()).sort()) {
    const list = flatten(await db(env, `claims/${date}`));
    const extra = overLimit(list);
    for (const c of extra) await db(env, `claims/${date}/${dbKey(c.hour)}/${dbKey(c.room)}`, 'DELETE');
    if (extra.length) await send(env, env.OWNER_CHAT_ID, `🚨 בוטלו ${extra.length} תפיסות מעל המגבלה ב-${date}:\n` +
      extra.map(c => `- ${c.by}: שעה ${c.hour}, ${c.room}`).join('\n') + '\nלא צריך לעשות כלום.');
    for (const s of suspiciousNames(list)) await once(`name ${date} ${s.name}`,
      `⚠️ חשד לעקיפת המגבלה ב-${date}: "${s.name}" תפס ${s.count} כיתות מ-${s.ids} מכשירים שונים. ` +
      `אולי שני אנשים עם אותו שם. אפשר לכתוב לי "תראה לי את התפיסות של ${date}" או "תבטל את התפיסות של ${s.name}".`);
  }

  // the timetable is refreshed every 30 min on school days; much older means scrape.mjs is broken
  const il = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const ageH = (Date.now() - new Date(data.updated)) / 36e5;
  if (il.getDay() <= 5 && il.getHours() >= 9 && il.getHours() < 17 && ageH > 3)
    await once(`stale ${today()}`, `⚠️ המערכת לא התעדכנה משחף כבר ${Math.round(ageH)} שעות. לבדוק ב-GitHub → Actions → update timetable.`);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // one-time: open https://<worker>/setup?key=<WEBHOOK_SECRET> to point Telegram at this worker
    if (url.pathname === '/setup' && env.WEBHOOK_SECRET && url.searchParams.get('key') === env.WEBHOOK_SECRET) {
      const r = await tg(env, 'setWebhook', { url: `${url.origin}/telegram`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message'] });
      return new Response(await r.text(), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname !== '/telegram' || !env.WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET)
      return new Response('not found', { status: 404 });

    const { message } = await req.json();
    if (!message?.text) return new Response('ok');
    if (String(message.chat.id) !== String(env.OWNER_CHAT_ID)) {
      // only the owner gets answers; the id is shown so the owner can find theirs on first setup
      await send(env, message.chat.id, `אין לך גישה לבוט הזה. (chat id: ${message.chat.id})`);
      return new Response('ok');
    }
    await tg(env, 'sendChatAction', { chat_id: message.chat.id, action: 'typing' });
    const reply = await ask(env, message.text).catch(e => `❌ שגיאה: ${e.message}`);
    await send(env, message.chat.id, reply);
    return new Response('ok');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(watchdog(env).catch(async e => {
      console.error(e);
      if (new Date().getUTCMinutes() < 15) await send(env, env.OWNER_CHAT_ID, `❌ הבוט נכשל בבדיקה: ${e.message}`); // at most once an hour
    }));
  },
};
