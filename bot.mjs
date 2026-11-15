// Watchdog: enforces max rooms per person per day and opens a GitHub issue (= email to the repo owner) when something needs a human.
// Run: node bot.mjs   (in GitHub Actions it gets GITHUB_TOKEN + GITHUB_REPOSITORY; locally it only prints alerts)
import { readFileSync } from 'node:fs';

export const MAX_PER_DAY = 2; // keep in sync with index.html
const DB_URL = 'https://free-room-4c651-default-rtdb.europe-west1.firebasedatabase.app';

// claims of one day ({hour: {room: {by,id,at}}}, Firebase may return an array) -> flat list
export const flatten = day => Object.entries(day || {}).flatMap(([hour, rooms]) =>
  Object.entries(rooms || {}).map(([room, c]) => ({ hour, room, ...c })));

// claims to remove: everything after a person's first MAX_PER_DAY (by time) that day
export function overLimit(list) {
  const byId = Object.groupBy(list, c => c.id);
  return Object.values(byId).flatMap(cs => cs.sort((a, b) => a.at - b.at).slice(MAX_PER_DAY));
}

// same name under several ids with too many rooms total: probably dodging the limit, a human should look
export function suspiciousNames(list) {
  return Object.entries(Object.groupBy(list, c => c.by))
    .filter(([, cs]) => new Set(cs.map(c => c.id)).size > 1 && cs.length > MAX_PER_DAY)
    .map(([name, cs]) => ({ name, count: cs.length, ids: new Set(cs.map(c => c.id)).size }));
}

async function alert(title, body) {
  console.log(`ALERT: ${title}\n${body}\n`);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  if (!token || !repo) return;
  const api = (path, opts = {}) => fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...opts, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
  const open = await api('issues?state=open&per_page=100').then(r => r.json());
  if (open.some(i => i.title === title)) return; // already reported and not closed yet
  const res = await api('issues', { method: 'POST', body: JSON.stringify({ title, body }) });
  if (!res.ok) throw new Error(`GitHub issue failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
  const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' });

  for (const date of Object.keys(data.days).filter(d => d >= today).sort()) {
    const res = await fetch(`${DB_URL}/claims/${date}.json`);
    if (!res.ok) throw new Error(`read ${date}: ${res.status}`);
    const list = flatten(await res.json());

    const extra = overLimit(list);
    for (const c of extra) {
      const del = await fetch(`${DB_URL}/claims/${date}/${c.hour}/${encodeURIComponent(c.room)}.json`, { method: 'DELETE' });
      if (!del.ok) throw new Error(`delete ${date}/${c.hour}/${c.room}: ${del.status}`);
    }
    if (extra.length) await alert(`בוטלו ${extra.length} תפיסות מעל המגבלה ב-${date}`,
      `מעל ${MAX_PER_DAY} כיתות לאדם ביום. נשארו התפיסות הראשונות, אלה בוטלו:\n\n` +
      extra.map(c => `- ${c.by}: שעה ${c.hour}, ${c.room}`).join('\n') + '\n\nלא צריך לעשות כלום, רק לסגור את ה-issue.');

    for (const s of suspiciousNames(list)) await alert(`חשד לעקיפת המגבלה: ${s.name} ב-${date}`,
      `השם "${s.name}" תפס ${s.count} כיתות מ-${s.ids} מכשירים/דפדפנים שונים. ` +
      `אולי שני אנשים עם אותו שם, ואולי מישהו עוקף את המגבלה.\nלבדוק ב-Firebase → Realtime Database → claims/${date}, ולמחוק ידנית אם צריך.`);
  }

  // timetable is refreshed every 30 min on school days; much older means scrape.mjs is broken
  const il = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const ageH = (Date.now() - new Date(data.updated)) / 36e5;
  if (il.getDay() <= 5 && il.getHours() >= 9 && il.getHours() < 17 && ageH > 3)
    await alert('המערכת לא מתעדכנת משחף',
      `data.json עודכן לאחרונה לפני ${Math.round(ageH)} שעות. לבדוק ב-Actions → update timetable למה הריצה נכשלת.`);
}

if (process.argv[1]?.endsWith('bot.mjs')) await main();
