const assert=require('node:assert/strict');
const {parameters}=require('../server/db/database');
assert.equal(parameters("SELECT '?' AS literal, ? AS value, 'it''s ?' AS quoted, ? AS other"),"SELECT '?' AS literal, $1 AS value, 'it''s ?' AS quoted, $2 AS other");
assert.equal(parameters('SELECT 1'),'SELECT 1');
assert.equal(parameters('SELECT ?::text, ?::int'),'SELECT $1::text, $2::int');
console.log('SQL parameter binding checks passed.');
