const assert=require('node:assert/strict');
const {parseImportCsv}=require('../server/services/importCsv');
const header='League,Area,Category,Source,Notes\r\n';
const rows=parseImportCsv('\uFEFF'+header+'"League, One",Toronto,Ice,https://example.com,"Line 1\nLine ""2"""\r\nTwo,,Ice,https://example.com,\r\n');
assert.equal(rows.length,2);assert.equal(rows[0].League,'League, One');assert.equal(rows[0].Notes,'Line 1\nLine "2"');assert.equal(rows[1].Area,'');assert.equal(rows[1].Notes,'');
assert.equal(parseImportCsv('name,City,category,url\nTeam,Toronto,Ice,https://example.com')[0].Source,'https://example.com');
for(const value of ['League,Area,Category\nA,B,C',header+'"unclosed',header+'A,B,C,D',header+'A,B,C,D,E,F','League,League,Category,Source\nA,B,C,D','League,name,Area,Category,Source\nA,B,C,D,E',header+'A"bad,B,C,D,E',header+'"A"bad,B,C,D,E'])assert.throws(()=>parseImportCsv(value),error=>error.status===400);
console.log('CSV quoting, multiline, empty cells, aliases and invalid-header checks passed.');
