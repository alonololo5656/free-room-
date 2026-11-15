// Telegram bot for the site owner, on Cloudflare Workers (see README → "בוט בטלגרם").
// - Answers fixed commands (/online, /today, /tomorrow, /cancel <name>), only to the owner.
// - Every 15 minutes it enforces the claim limit and messages you about anything unusual.
// Secrets (wrangler secret put): TELEGRAM_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET, FIREBASE_SA
import { MAX_PER_DAY, flatten, overLimit, suspiciousNames } from '../bot.mjs';

const DB_URL = 'https://free-room-4c651-default-rtdb.europe-west1.firebasedatabase.app';
const SITE = 'https://alonololo5656.github.io/free-room-';
const ilDate = t => new Date(t).toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' });
const today = () => ilDate(Date.now());
const tomorrow = () => ilDate(Date.now() + 864e5);
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
const timetable = () => fetch(`${SITE}/data.json`, { cache: 'no-store' }).then(r => r.json());

// ---------- Telegram ----------
const tg = (env, method, body) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`,
  { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const send = (env, chat_id, text) => tg(env, 'sendMessage', { chat_id, text: text.slice(0, 4000) });

// ---------- commands ----------
const COMMANDS = [
  ['online', 'מי מחובר עכשיו וכמה נכנסו היום'],
  ['today', 'כל התפיסות של היום'],
  ['tomorrow', 'כל התפיסות של מחר'],
  ['cancel', 'ביטול תפיסות של שם, למשל: /cancel דני'],
];
const HELP = 'מה אפשר לבקש:\n' + COMMANDS.map(([c, d]) => `/${c} – ${d}`).join('\n');

async function online(env) {
  const all = Object.values(await db(env, 'online') || {});
  const now = all.filter(u => u.at > Date.now() - 3 * 60e3).sort((a, b) => b.at - a.at);
  const names = now.map(u => u.by || 'בלי שם (עוד לא תפס כיתה)');
  return `🟢 מחוברים עכשיו: ${now.length}` + (names.length ? '\n' + names.map(n => `- ${n}`).join('\n') : '') +
    `\n📅 נכנסו היום: ${all.filter(u => ilDate(u.at) === today()).length} מכשירים` +
    `\n📊 בסך הכול: ${all.length} מכשירים`;
}

async function claimsOf(env, date) {
  const list = flatten(await db(env, `claims/${date}`)).sort((a, b) => a.hour - b.hour || a.room.localeCompare(b.room));
  if (!list.length) return `אין תפיסות ב-${date}.`;
  return `🙋 תפיסות ב-${date} (${list.length}):\n` + list.map(c => `- שעה ${c.hour}, ${c.room}: ${c.by}`).join('\n');
}

// cancels every claim under that exact name, today and on later days
async function cancel(env, name) {
  if (!name) return 'צריך לכתוב שם, למשל: /cancel דני';
  const dates = Object.keys((await timetable()).days).filter(d => d >= today());
  const done = [];
  for (const date of dates)
    for (const c of flatten(await db(env, `claims/${date}`)).filter(c => c.by.trim() === name)) {
      await db(env, `claims/${date}/${dbKey(c.hour)}/${dbKey(c.room)}`, 'DELETE');
      done.push(`- ${date}, שעה ${c.hour}, ${c.room}`);
    }
  return done.length ? `✅ בוטלו ${done.length} תפיסות של "${name}":\n${done.join('\n')}` : `לא מצאתי תפיסות בשם "${name}" (השם צריך להיות בדיוק כמו באתר).`;
}

export async function handle(env, text) {
  const [, cmd, arg = ''] = text.trim().match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/) || [];
  if (cmd === 'online') return online(env);
  if (cmd === 'today') return claimsOf(env, today());
  if (cmd === 'tomorrow') return claimsOf(env, tomorrow());
  if (cmd === 'cancel') return cancel(env, arg.trim());
  return HELP;
}

// ---------- watchdog (cron) ----------
async function watchdog(env) {
  const data = await timetable();
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
    if (extra.length) await send(env, env.OWNER_CHAT_ID, `🚨 בוטלו ${extra.length} תפיסות מעל המגבלה (${MAX_PER_DAY} ביום) ב-${date}:\n` +
      extra.map(c => `- ${c.by}: שעה ${c.hour}, ${c.room}`).join('\n') + '\nלא צריך לעשות כלום.');
    for (const s of suspiciousNames(list)) await once(`name ${date} ${s.name}`,
      `⚠️ חשד לעקיפת המגבלה ב-${date}: "${s.name}" תפס ${s.count} כיתות מ-${s.ids} מכשירים שונים. ` +
      `אולי שני אנשים עם אותו שם. לבדיקה: /today או /tomorrow. לביטול: /cancel ${s.name}`);
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
      await tg(env, 'setMyCommands', { commands: COMMANDS.map(([command, description]) => ({ command, description })) });
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
    const reply = await handle(env, message.text).catch(e => `❌ שגיאה: ${e.message}`);
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
