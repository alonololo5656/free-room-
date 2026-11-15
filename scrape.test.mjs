// Run: node scrape.test.mjs   (markup copied from the real Shahaf page)
import assert from 'node:assert/strict';
import { parsePage, build } from './scrape.mjs';

const page = (cell) => `<table class="TTTable"><tr>
<td class="CName"></td><td class="CTitle" data-day="0">יום ראשון 15.11</td>
<td class="CTitle" data-day="1"><span>יום שני 16.11</span> <span class="Holiday">חג</span></td></tr>
<tr><td class="CName"><b>1<br/><span class="hour-time">08:15</span><br/><span class="hour-time">09:00</span></b></td>
<td class="TTCell" data-day="0">${cell}</td><td class="TTCell" data-day="1"></td></tr></table>`;

const a = parsePage(page(`<div class="TTLesson"><b>פיזיקה</b>&nbsp;&nbsp;(ט1 104)<br>גבאי (רפואה) אור</div>
<div class="TTLesson"><b>חינוך גופני</b><br>ניסן שרון</div>`));
const b = parsePage(page(`<div class="TTChange TableFreeChange">ביטול מתמטיקה, ושדי סיוון</div>
<div class="TTChange TableFillChange">טובי שושה -&gt; חדר: מח3 - 319</div>
<div class="TTChange TableExamChange">מבחן כימיה , ט4 204<br>לקבוצה של ידיגר עידית</div>
<div class="TTChange TableEventChange">ניהול פיננסי, אולם כנסים</div>`));
const c = parsePage(page(`<div class="TTLesson"><b>מתמטיקה</b>&nbsp;&nbsp;(ט4 204)<br>x</div>`));

assert.equal(a[0].date.slice(5), '11-15');
assert.equal(a[1].holiday, 'חג');
assert.equal(a[0].items[0].room, 'ט1 104'); // teacher's "(רפואה)" is not a room
assert.equal(a[0].items[1].room, null); // gym: no room

const d = build([a, b, c]);
assert.deepEqual(d.rooms, ['ט1 104', 'ט4 204', 'מח3 - 319']); // "אולם כנסים" is not a known lesson room
assert.deepEqual(d.days[a[0].date].hours['1'].busy, ['ט1 104', 'ט4 204', 'מח3 - 319']);
assert.deepEqual(d.days[a[1].date].hours['1'].busy, []);
assert.equal(d.days[a[1].date].holiday, 'חג');
console.log('ok');
