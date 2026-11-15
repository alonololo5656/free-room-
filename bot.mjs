// Claim-limit logic, shared by the bot (worker/worker.js) and its test (bot.test.mjs).

export const MAX_PER_DAY = 2; // keep in sync with index.html

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
