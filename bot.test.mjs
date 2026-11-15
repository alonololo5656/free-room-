// Run: node bot.test.mjs
import assert from 'node:assert/strict';
import { flatten, overLimit, suspiciousNames } from './bot.mjs';

const c = (id, by, at) => ({ id, by, at });
// Firebase returns numeric hour keys as an array with holes
const list = flatten([null, { r1: c('a', 'דנה', 3), r2: c('a', 'דנה', 1), r3: c('b', 'רון', 5) }, { r4: c('a', 'דנה', 2), r5: c('x', 'רון', 6), r6: c('y', 'רון', 7) }]);

assert.equal(list.length, 6);
assert.deepEqual(overLimit(list).map(x => x.room), ['r1']); // dana keeps her two earliest (r2, r4)
assert.deepEqual(suspiciousNames(list), [{ name: 'רון', count: 3, ids: 3 }]);
assert.deepEqual(overLimit(flatten(null)), []);
console.log('bot ok');
