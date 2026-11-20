import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowUpRight, Calendar, MapPin, Trophy } from 'lucide-react';
import EventInterestModal from '../components/EventInterestModal';
import { safeUrl } from '../lib/safeUrl';
import { setMetadata } from '../lib/metadata';

const stateLabels = {
  announced: 'Announced',
  'interest-only': 'Interest Only',
  'registration-open': 'Registration Open',
  'registration-closed': 'Registration Closed',
  full: 'Full',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

function formatEventDate(value, timeZone) {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const date = new Date(`${datePart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timeZone || 'UTC'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }
}

function formatPrice(event) {
  if (event.price_amount === null || event.price_amount === undefined) return 'Price not confirmed';
  const amount = Number(event.price_amount);
  if (!Number.isFinite(amount)) return 'Price not confirmed';
  return `${event.price_currency ? `${event.price_currency} ` : ''}$${amount.toLocaleString()}${event.price_unit ? ` (${event.price_unit})` : ''}`;
}

export default function EventDetailPage({ slug, navigate, onExternalClick }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [interestOpen, setInterestOpen] = useState(false);

  useEffect(() => {
    if (event) setMetadata(`${event.title} | Events | RinkCircuit`, true, event.description||'Event information and interest options. Interest does not confirm entry.');
  }, [event]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchEvent() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(slug)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? 'This event is not published.' : 'Unable to load this event.');
        const data = await response.json();
        if (!controller.signal.aborted) setEvent(data.data);
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setEvent(null);
          setError(fetchError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchEvent();
    return () => controller.abort();
  }, [slug, retry]);

  if (loading) return <p role="status" className="max-w-4xl mx-auto px-4 py-12">Loading event details…</p>;

  if (error || !event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Event details unavailable</h1>
        <p role="alert" className="text-sm text-slate-600">{error || 'This event is not published.'}</p>
        {error && !error.includes('not published') && <button type="button" onClick={() => setRetry(value => value + 1)} className="px-4 py-2 text-sm font-semibold text-blue-700 underline">Retry</button>}
        <button type="button" onClick={() => navigate('/tournaments')} className="flex items-center gap-2 mx-auto px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
      </div>
    );
  }

  const startDate = formatEventDate(event.start_date, event.timezone);
  const endDate = formatEventDate(event.end_date, event.timezone);
  const interestAvailable = ['announced', 'interest-only'].includes(event.lifecycle_state);
  const registrationUrl = event.lifecycle_state === 'registration-open' ? safeUrl(event.registration_url) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <button type="button" onClick={() => navigate('/tournaments')} className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </button>

      <article className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <header className="space-y-3">
          <span className="inline-flex text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800">
            {stateLabels[event.lifecycle_state] || 'Status not confirmed'}
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900">{event.title}</h1>
          {event.description && <p className="text-slate-600 leading-relaxed">{event.description}</p>}
        </header>

        <div className="grid gap-4 sm:grid-cols-2 border-y border-slate-100 py-5 text-sm">
          <div className="flex gap-3">
            <Calendar aria-hidden="true" className="w-5 h-5 text-blue-600 shrink-0" />
            <dl><dt className="font-semibold text-slate-800">Dates</dt><dd className="text-slate-600">{startDate ? `${startDate}${endDate && endDate !== startDate ? ` – ${endDate}` : ''}` : 'Not confirmed'}</dd></dl>
          </div>
          <div className="flex gap-3">
            <MapPin aria-hidden="true" className="w-5 h-5 text-blue-600 shrink-0" />
            <dl><dt className="font-semibold text-slate-800">Location</dt><dd className="text-slate-600">{event.location_name || event.city || 'Not confirmed'}</dd></dl>
          </div>
          <div className="flex gap-3">
            <Trophy aria-hidden="true" className="w-5 h-5 text-blue-600 shrink-0" />
            <dl><dt className="font-semibold text-slate-800">Divisions</dt><dd className="text-slate-600">{event.divisions || 'Not confirmed'}</dd></dl>
          </div>
          <dl><dt className="font-semibold text-slate-800">Price</dt><dd className="text-slate-600">{formatPrice(event)}</dd></dl>
          <dl><dt className="font-semibold text-slate-800">Time zone</dt><dd className="text-slate-600">{event.timezone || 'Not confirmed'}</dd></dl>
          <dl><dt className="font-semibold text-slate-800">Registration deadline</dt><dd className="text-slate-600">{formatEventDate(event.registration_deadline, event.timezone) || 'Not confirmed'}</dd></dl>
          <dl><dt className="font-semibold text-slate-800">Guaranteed games</dt><dd className="text-slate-600">{event.guaranteed_games ?? 'Not confirmed'}</dd></dl>
          <dl><dt className="font-semibold text-slate-800">Format</dt><dd className="text-slate-600">{event.format || 'Not confirmed'}</dd></dl>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {registrationUrl && (
            <button type="button" onClick={() => onExternalClick(registrationUrl, event.title, 'external_registration_clicked')} className="bg-[#1463DF] hover:bg-blue-700 text-white font-semibold text-sm px-5 py-3 rounded-xl flex items-center gap-2">
              Visit Official Registration <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
          {interestAvailable && (
            <button type="button" onClick={() => setInterestOpen(true)} className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold text-sm px-5 py-3 rounded-xl">
              Express Interest
            </button>
          )}
          {event.lifecycle_state === 'registration-open' && !registrationUrl && <p className="text-sm text-slate-600">Official registration details are not available.</p>}
          {event.policy_url && safeUrl(event.policy_url) && (
            <a href={safeUrl(event.policy_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">Event policy</a>
          )}
        </div>
        {interestAvailable && <p className="text-xs text-slate-500">Interest does not guarantee entry or reserve a place.</p>}
      </article>

      {interestOpen && <EventInterestModal event={event} onClose={() => setInterestOpen(false)} />}
    </div>
  );
}
