import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import useDialog from './useDialog';

export default function EventInterestModal({ event, onClose }) {
  const [email, setEmail] = useState('');
  const [registrationMode, setRegistrationMode] = useState('team');
  const [teamName, setTeamName] = useState('');
  const [division, setDivision] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const dialogRef = useDialog(!!event, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_type: 'tournament',
          event_id: event.id,
          email,
          city: event.city || '',
          registration_mode: registrationMode,
          team_name: teamName.trim() || undefined,
          division: division.trim() || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to record event interest.');
      setReceipt(data);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-interest-title"
        tabIndex={-1}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative"
      >
        <button type="button" onClick={onClose} aria-label="Close event interest form" className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 p-2">
          ×
        </button>

        {receipt ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 id="event-interest-title" className="font-bold text-slate-900 text-lg">Interest recorded</h2>
            <p className="text-sm text-slate-600">{receipt.message}</p>
            {receipt.submission_id && <p className="text-xs text-slate-500">Submission ID: {receipt.submission_id}</p>}
            <p className="text-sm text-slate-600">This does not register you, reserve a place, or confirm entry.</p>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 id="event-interest-title" className="font-bold text-slate-900 text-lg">Express event interest</h2>
              <p className="text-sm text-slate-600 mt-1">{event.title}</p>
              <p className="text-xs text-slate-500 mt-2">This is an interest request only. It does not register you, reserve a place, or confirm entry.</p>
            </div>

            {error && <p role="alert" className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-sm">{error}</p>}

            <div>
              <label htmlFor="event-interest-email" className="block font-semibold text-slate-700 mb-1">Email address</label>
              <input
                id="event-interest-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <fieldset>
              <legend className="block font-semibold text-slate-700 mb-2">Interested as</legend>
              <div className="flex gap-4">
                {['team', 'individual'].map(mode => (
                  <label key={mode} className="flex items-center gap-2">
                    <input type="radio" name="event-registration-mode" value={mode} checked={registrationMode === mode} onChange={() => setRegistrationMode(mode)} />
                    <span className="capitalize">{mode}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="event-interest-team" className="block font-semibold text-slate-700 mb-1">Team name (optional)</label>
              <input id="event-interest-team" type="text" maxLength={200} value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>

            <div>
              <label htmlFor="event-interest-division" className="block font-semibold text-slate-700 mb-1">Preferred division (optional)</label>
              <input id="event-interest-division" type="text" maxLength={200} value={division} onChange={e => setDivision(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Interest'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
