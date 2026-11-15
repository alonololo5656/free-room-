// Reads every class's "מערכת ושינויים" table from Blich's public Shahaf site
// and writes data.json: which rooms are busy at each day/hour, and which teacher is in which room.
// No dependencies (Node 18+).
import { writeFileSync } from 'node:fs';

const BASE = 'https://blich.shahaf.site';
const WEEKS = [0, 1]; // this week + next week

const get = async (path) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + path);
      if (r.ok) return await r.text();
    } catch {}
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  throw new Error('failed to fetch ' + path);
};

const text = (html) =>
  html.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

// "15.11" -> "2026-11-15", choosing the year closest to today
function isoDate(dm, now = new Date()) {
  const [d, m] = dm.split('.').map(Number);
  let y = now.getFullYear();
  if (m - (now.getMonth() + 1) > 6) y--;
  if ((now.getMonth() + 1) - m > 6) y++;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Parses one class page into [{date, holiday, hour, start, end, items:[{kind, room?, ...}]}]
export function parsePage(html) {
  const table = html.match(/<table[^>]*TTTable[\s\S]*?<\/table>/)?.[0];
  if (!table) return [];
  const rows = table.split(/<tr[\s>]/).slice(1);
  const days = {};
  for (const m of rows[0].matchAll(/<td class="CTitle[^"]*" data-day="(\d)">([\s\S]*?)<\/td>/g)) {
    const t = text(m[2]);
    const dm = t.match(/\d{1,2}\.\d{1,2}/);
    if (!dm) continue;
    const holiday = m[2].match(/class="Holiday">([\s\S]*?)<\/span>/);
    days[m[1]] = { date: isoDate(dm[0]), holiday: holiday ? text(holiday[1]) : '' };
  }
  const out = [];
  for (const row of rows.slice(1)) {
    const h = row.match(/class="CName"><b>(\d+)<br\/?><span class="hour-time">([\d:]+)<\/span><br\/?><span class="hour-time">([\d:]+)<\/span>/);
    if (!h) continue;
    for (const c of row.matchAll(/<td class="TTCell[^"]*" data-day="(\d)">([\s\S]*?)<\/td>/g)) {
      if (!days[c[1]]) continue;
      const items = [];
      for (const d of c[2].matchAll(/<div class="(TTLesson|TTChange (\w+))">([\s\S]*?)<\/div>/g)) {
        const kind = d[2] || 'Lesson';
        const first = text(d[3]).split('\n')[0];
        let room = null;
        if (kind === 'Lesson') room = first.match(/\(([^)]*)\)\s*$/)?.[1] ?? null;
        else if (kind === 'TableFillChange') room = first.match(/חדר:\s*(.+)$/)?.[1] ?? null;
        else if (kind === 'TableExamChange' || kind === 'TableEventChange') {
          const i = first.lastIndexOf(',');
          room = i >= 0 ? first.slice(i + 1) : null; // kept only if it is a known room (see below)
        }
        items.push({ kind, room: room?.trim() || null, text: text(d[3]) });
      }
      out.push({ ...days[c[1]], hour: h[1], start: h[2], end: h[3], items });
    }
  }
  return out;
}

// the longest known room that `s` ends with, or null
const roomAtEnd = (s, rooms) => {
  let best = null;
  for (const r of rooms) if ((s === r || s.endsWith(' ' + r)) && r.length > (best?.length ?? 0)) best = r;
  return best;
};
const clean = (s) => s?.replace(/\s+/g, ' ').trim() || null;

// Which teachers an item puts in a room (present: [[name, room|null]]) and which it takes out (absent: [name]).
// Formats seen on the real site:
//   Lesson           "פיזיקה  (ט1 104)\nשטיינברוך אפרים"        present: 2nd line, in the lesson's room
//   TableFreeChange  "ביטול מתמטיקה, ושדי סיוון"                absent: after the last comma
//   TableFillChange  "טובי שושה -> חדר: מח3 - 319"              present: moved to that room
//                    "יעקב טל <- רגב עדי, היסטוריה יא14 142"   present: substitute (room = known room at the end), absent: the one replaced
//                    "הזזת ביולוגיה, מימון חני לשעה 6"         absent: lesson moved to another hour
//                    "השלמה  אלקבץ שפי ליזה, חינוך" / "תגבור ..." present (room only if a known room ends the line)
//                    "לוי שחר, חינוך גופני"                     present, no room
// Exams/events only say "לקבוצה של X" (the group's teacher, not necessarily who is in the room), so they are skipped.
export function teachersOf(item, rooms = new Set()) {
  const [line = '', second] = item.text.split('\n').map((l) => l.trim());
  const present = [], absent = [];
  let m;
  if (item.kind === 'Lesson') present.push([clean(second), item.room]);
  else if (item.kind === 'TableFreeChange') { if (line.includes(',')) absent.push(clean(line.slice(line.lastIndexOf(',') + 1))); }
  else if (item.kind === 'TableFillChange') {
    if ((m = line.match(/^(.+?)\s*->\s*חדר:/))) present.push([clean(m[1]), item.room]);
    else if ((m = line.match(/^(.+?)\s*<-\s*(.+)$/))) {
      const room = roomAtEnd(m[2], rooms);
      present.push([clean(m[1]), room]);
      absent.push(clean((room ? m[2].slice(0, -room.length) : m[2]).split(',')[0]));
    } else if ((m = line.match(/^הזזת\s.*,\s*(.+?)\s+לשעה\s+\d+$/))) absent.push(clean(m[1]));
    else if ((m = line.match(/^(?:השלמה|תגבור)\s+([^,]+)/))) present.push([clean(m[1]), roomAtEnd(line, rooms)]);
    else if ((m = line.match(/^([^,]+),/))) present.push([clean(m[1]), null]);
  }
  return { present: present.filter(([n]) => n), absent: absent.filter(Boolean) };
}

export function build(pages) {
  const cells = pages.flat();
  // the room list = every room a regular lesson uses; exam/event text only counts if it names one of these
  const rooms = new Set(cells.flatMap((c) => c.items.filter((i) => i.kind === 'Lesson' && i.room).map((i) => i.room)));
  const days = {};
  for (const c of cells) {
    const day = (days[c.date] ??= { holiday: c.holiday, hours: {} });
    if (c.holiday) day.holiday = c.holiday;
    const hour = (day.hours[c.hour] ??= { start: c.start, end: c.end, busy: new Set(), lessons: [], fills: [], cancelled: new Set() });
    for (const i of c.items) {
      if (i.room && (i.kind === 'TableFillChange' || rooms.has(i.room))) {
        rooms.add(i.room);
        hour.busy.add(i.room);
      }
      const { present, absent } = teachersOf(i, rooms);
      (i.kind === 'Lesson' ? hour.lessons : hour.fills).push(...present);
      for (const t of absent) hour.cancelled.add(t);
    }
  }
  for (const d of Object.values(days))
    for (const h of Object.values(d.hours)) {
      h.busy = [...h.busy].sort();
      // teachers: { name: room } for this hour; room is null when the lesson has no room (e.g. gym).
      // A cancelled/replaced/moved lesson removes its teacher; a change that puts a teacher in a room always wins.
      const teachers = {};
      for (const [t, room] of h.lessons) if (!h.cancelled.has(t) && teachers[t] == null) teachers[t] = room;
      for (const [t, room] of h.fills) teachers[t] = room;
      h.teachers = Object.fromEntries(Object.entries(teachers).sort(([a], [b]) => a.localeCompare(b, 'he')));
      delete h.lessons; delete h.fills; delete h.cancelled;
    }
  return { updated: new Date().toISOString(), rooms: [...rooms].sort(), days };
}

async function main() {
  const home = await get('/');
  const select = home.match(/<select[^>]*name="cls"[\s\S]*?<\/select>/)?.[0];
  const ids = [...(select ?? '').matchAll(/value="(\d+)"/g)].map((m) => m[1]);
  if (ids.length < 10) throw new Error('class list not found - did the Shahaf site change?');
  const jobs = WEEKS.flatMap((w) => ids.map((id) => `/?cls=${id}&tab=changestable&week=${w}`));
  const pages = [];
  for (let i = 0; i < jobs.length; i += 6) // 6 at a time, to be gentle with the school's server
    pages.push(...(await Promise.all(jobs.slice(i, i + 6).map(async (p) => parsePage(await get(p))))));
  const data = build(pages);
  if (data.rooms.length < 20) throw new Error('too few rooms parsed - not overwriting data.json');
  writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(data));
  console.log(`${ids.length} classes, ${data.rooms.length} rooms, ${Object.keys(data.days).length} days`);
}

if (process.argv[1]?.endsWith('scrape.mjs')) await main();
