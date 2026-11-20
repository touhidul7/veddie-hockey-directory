const assert = require('node:assert/strict');
const express = require('express');
const { validateSubmission } = require('../server/middleware/validateSubmission');

async function run() {
  const app = express();
  app.use(express.json());
  for (const kind of ['interest', 'listing', 'verification', 'resend']) {
    app.post('/' + kind, validateSubmission(kind), (req, res) => res.json({ accepted: true }));
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let count = 0;
  try {
    async function check(kind, body, expected, field) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.status, expected);
      const data = await response.json();
      if (field) assert.ok(data.fields[field]);
      count++;
    }
    const interest = { email: 'captain@example.com', interest_type: 'captain_team', team_name: 'Team' };
    await check('interest', { ...interest, marketing_consent: false, roster_size_estimate: '15', preferred_nights: ['Monday'] }, 200);
    await check('interest', { ...interest, marketing_consent: 'false' }, 400, 'marketing_consent');
    await check('interest', { ...interest, publication_consent: 'true' }, 400, 'publication_consent');
    await check('interest', { ...interest, publication_consent: false }, 200);
    await check('interest', { ...interest, marketing_consent: 1 }, 400, 'marketing_consent');
    for (const field of ['name', 'email', 'city', 'team_name', 'event_id', 'phone', 'additional_notes']) {
      await check('interest', { ...interest, [field]: { injected: true } }, 400, field);
    }
    await check('interest', { ...interest, team_name: ' ' }, 400, 'team_name');
    await check('interest', { ...interest, interest_type: 'unsupported' }, 400, 'interest_type');
    await check('interest', { ...interest, additional_notes: 'a'.repeat(5001) }, 400, 'additional_notes');
    await check('interest', { ...interest, additional_notes: ' '.repeat(5001) }, 400, 'additional_notes');
    await check('interest', { ...interest, preferred_nights: ['Funday'] }, 400, 'preferred_nights');
    for (const size of [true, '12players', 1.5, 101, -1]) await check('interest', { ...interest, roster_size_estimate: size }, 400, 'roster_size_estimate');
    await check('interest', [], 400);
    const listing = { request_type: 'correction', requester_name: 'Reviewer', requester_email: 'person@example.com' };
    await check('listing', { ...listing, evidence_url: 'https://example.com/source' }, 200);
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com']) await check('listing', { ...listing, evidence_url: url }, 400, 'evidence_url');
    await check('listing', { ...listing, requester_name: [] }, 400, 'requester_name');
    await check('resend', { email: 'bad@' }, 400, 'email');
    await check('resend', { email: 'person@example.com' }, 200);
    await check('verification', { token: {} }, 400, 'token');
    await check('verification', { token: 'a'.repeat(257) }, 400, 'token');
    console.log(`Submission validation checks passed: ${count}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
