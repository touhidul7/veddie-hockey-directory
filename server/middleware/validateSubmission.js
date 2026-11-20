const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nights = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Validate before database work. Never coerce objects or consent strings.
function validateSubmission(kind) {
  return (req, res, next) => {
    const body = req.body;
    const fields = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'A JSON object is required.', code: 'INVALID_SUBMISSION' });
    }
    function text(name, max, required = false) {
      const value = body[name];
      if (value === undefined || value === null || value === '') {
        if (required) fields[name] = 'This field is required.';
        return;
      }
      if (typeof value !== 'string') fields[name] = 'Enter text.';
      else if (value.length > max) fields[name] = `Use at most ${max} characters.`;
      else if (required && !value.trim()) fields[name] = 'This field is required.';
      else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fields[name] = 'Unsupported control characters.';
    }
    function email(name) {
      text(name, 254, true);
      if (!fields[name] && !emailPattern.test(body[name].trim())) fields[name] = 'Enter a valid email address.';
    }
    function choice(name, allowed, required = false) {
      if (body[name] === undefined && !required) return;
      if (!allowed.includes(body[name])) fields[name] = 'Choose a supported option.';
    }
    if (kind === 'interest') {
      email('email');
      choice('interest_type', ['captain_team', 'tournament', 'request_a_league'], true);
      for (const name of ['name', 'city', 'team_name', 'home_league', 'division']) text(name, 200);
      text('team_name', 200, body.interest_type === 'captain_team');
      text('phone', 50);
      text('role', 80);
      text('event_id', 150);
      text('skill_description', 2000);
      text('additional_notes', 5000);
      if (body.marketing_consent !== undefined && typeof body.marketing_consent !== 'boolean') fields.marketing_consent = 'Consent must be true or false.';
      if (body.publication_consent !== undefined && typeof body.publication_consent !== 'boolean') fields.publication_consent = 'Publication consent must be true or false.';
      if (body.preferred_nights !== undefined && (!Array.isArray(body.preferred_nights) || body.preferred_nights.length > 7 || body.preferred_nights.some(day => !nights.includes(day)))) fields.preferred_nights = 'Choose valid days of the week.';
      const size = body.roster_size_estimate;
      if (size !== undefined && size !== null && size !== '' &&
          !((typeof size === 'number' || (typeof size === 'string' && /^\d+$/.test(size))) && Number.isInteger(Number(size)) && Number(size) >= 1 && Number(size) <= 100)) fields.roster_size_estimate = 'Enter a whole number between 1 and 100.';
      choice('registration_mode', ['individual', 'team', 'small_group']);
    } else if (kind === 'listing') {
      choice('request_type', ['claim', 'correction', 'new_addition', 'removal'], true);
      email('requester_email');
      text('requester_name', 200, true);
      for (const name of ['programme_id', 'suggested_name', 'requester_role']) text(name, 200);
      text('message', 5000);
      text('evidence_url', 2048);
      if (body.evidence_url && !fields.evidence_url) {
        try {
          const url = new URL(body.evidence_url);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        } catch { fields.evidence_url = 'Enter an HTTP or HTTPS URL without embedded credentials.'; }
      }
    } else if (kind === 'resend') email('email');
    else if (kind === 'verification') text('token', 256, true);
    if (Object.keys(fields).length) return res.status(400).json({ error: Object.values(fields)[0], code: 'INVALID_SUBMISSION', fields });
    next();
  };
}
module.exports = { validateSubmission };
