// Run: node worker.test.mjs   (no network: fetch is faked)
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import worker from './worker.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { TELEGRAM_TOKEN: 't', OWNER_CHAT_ID: '42', WEBHOOK_SECRET: 's3cret', ANTHROPIC_API_KEY: 'x',
  FIREBASE_SA: JSON.stringify({ client_email: 'bot@x.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };

const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), opts });
  if (String(url).includes('oauth2.googleapis.com')) {
    const jwt = new URLSearchParams(opts.body).get('assertion').split('.');
    const ok = createVerify('RSA-SHA256').update(jwt[0] + '.' + jwt[1]).verify(publicKey, Buffer.from(jwt[2], 'base64url'));
    assert.ok(ok, 'service-account JWT signature must verify');
    return Response.json({ access_token: 'admin', expires_in: 3600 });
  }
  if (String(url).includes('data.json')) return Response.json({ updated: new Date().toISOString(), days: { '2999-01-01': {} } });
  if (String(url).includes('/claims/2999-01-01.json')) return Response.json([null, { a: { by: 'x', id: 'u', at: 1 }, b: { by: 'x', id: 'u', at: 2 }, c: { by: 'x', id: 'u', at: 3 } }]);
  if (String(url).includes('firebasedatabase')) return Response.json(null);
  return Response.json({ ok: true });
};
const post = (headers, body) => worker.fetch(new Request('https://w.dev/telegram', { method: 'POST', headers, body: JSON.stringify(body) }), env);

// no / wrong secret header -> 404, nothing sent
assert.equal((await post({}, {})).status, 404);
assert.equal((await post({ 'x-telegram-bot-api-secret-token': 'nope' }, {})).status, 404);
assert.equal(calls.length, 0);

// a stranger gets no access, and the database is never touched
await post({ 'x-telegram-bot-api-secret-token': 's3cret' }, { message: { chat: { id: 7 }, text: '/cancel x' } });
assert.equal(calls.length, 1);
assert.match(calls[0].opts.body, /אין לך גישה/);

// owner commands
const reply = async text => { calls.length = 0; await post({ 'x-telegram-bot-api-secret-token': 's3cret' }, { message: { chat: { id: 42 }, text } });
  return JSON.parse(calls.find(c => c.url.includes('sendMessage')).opts.body).text; };
assert.match(await reply('שלום'), /\/online/); // unknown text -> help
assert.match(await reply('/online'), /מחוברים עכשיו: 0/);
assert.match(await reply('/cancel'), /צריך לכתוב שם/);
assert.match(await reply('/cancel x'), /בוטלו 3 תפיסות של "x"/);
assert.equal(calls.filter(c => c.opts.method === 'DELETE').length, 3);
assert.match(await reply('/cancel מישהו'), /לא מצאתי/);

// watchdog: 3 claims by one device -> the latest one is deleted with the admin token, owner is told
calls.length = 0;
let job; await worker.scheduled({}, env, { waitUntil: p => (job = p) }); await job;
const del = calls.filter(c => c.opts.method === 'DELETE');
assert.equal(del.length, 1);
assert.match(del[0].url, /claims\/2999-01-01\/1\/c\.json\?access_token=admin/);
assert.ok(calls.some(c => c.url.includes('sendMessage') && c.opts.body.includes('בוטלו 1')));
console.log('worker ok');
