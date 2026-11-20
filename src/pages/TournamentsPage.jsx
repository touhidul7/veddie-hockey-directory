import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Award, Calendar, MapPin, Trophy } from 'lucide-react';
import EventInterestModal from '../components/EventInterestModal';

function formatEventDate(value, timeZone) {
  if (!value) return 'Not confirmed';
  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return 'Not confirmed';
  const date = new Date(`${datePart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Not confirmed';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: timeZone || 'UTC'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
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

const stateBadges = {
  'registration-open': { label: 'Registration Open', bg: 'bg-emerald-100 text-emerald-800' },
  announced: { label: 'Announced', bg: 'bg-amber-100 text-amber-800' },
  'interest-only': { label: 'Interest Only', bg: 'bg-amber-100 text-amber-800' },
  'registration-closed': { label: 'Registration Closed', bg: 'bg-slate-200 text-slate-800' },
  full: { label: 'Full', bg: 'bg-slate-200 text-slate-800' },
  completed: { label: 'Completed', bg: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100 text-slate-600' }
};

export default function TournamentsPage({ navigate, onExternalClick }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchEvents() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/events', { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load published events.');
        const data = await response.json();
        if (!controller.signal.aborted) setEvents(data.data || []);
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setEvents([]);
          setError(fetchError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchEvents();
    return () => controller.abort();
  }, [retry]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Adult Hockey Tournaments & Events</h1>
        <p className="text-sm text-slate-600">Review published event details. Dates, prices, eligibility, and registration are shown only when confirmed.</p>
      </header>

      {loading ? (
        <p role="status" className="text-sm text-slate-600">Loading published events…</p>
      ) : error ? (
        <div role="alert" className="bg-white rounded-xl border border-red-200 p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-800"><AlertCircle className="w-5 h-5" /><p>{error}</p></div>
          <button type="button" onClick={() => setRetry(value => value + 1)} className="text-sm font-semibold text-blue-700 underline">Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Trophy aria-hidden="true" className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="font-bold text-slate-800 text-base">No Events Published</h2>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">There are no published event listings at this time. Check back for updates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map(event => {
            const badge = stateBadges[event.lifecycle_state] || { label: 'Status not confirmed', bg: 'bg-slate-100 text-slate-700' };
            const interestAvailable = ['announced', 'interest-only'].includes(event.lifecycle_state);
            const registrationAvailable = event.lifecycle_state === 'registration-open' && !!event.registration_url;

            return (
              <article key={event.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg}`}>{badge.label}</span>
                    <span className="text-sm font-semibold text-slate-800">{formatPrice(event)}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">
                    <a href={`/tournaments/${event.slug}`} onClick={click => {
                      if (click.button === 0 && !click.metaKey && !click.ctrlKey && !click.shiftKey && !click.altKey) {
                        click.preventDefault();
                        navigate(`/tournaments/${event.slug}`);
                      }
                    }} className="hover:text-blue-700 underline-offset-2 hover:underline">
                      {event.title}
                    </a>
                  </h2>
                  {event.description && <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <Calendar aria-hidden="true" className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <dl><dt className="font-medium text-slate-700">Dates</dt><dd>{formatEventDate(event.start_date, event.timezone)}{event.end_date && event.end_date !== event.start_date ? ` – ${formatEventDate(event.end_date, event.timezone)}` : ''}</dd></dl>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin aria-hidden="true" className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <dl><dt className="font-medium text-slate-700">Location</dt><dd>{event.location_name || event.city || 'Not confirmed'}</dd></dl>
                    </div>
                    <div className="flex items-start gap-2">
                      <Award aria-hidden="true" className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <dl><dt className="font-medium text-slate-700">Divisions</dt><dd>{event.divisions || 'Not confirmed'}</dd></dl>
                    </div>
                    <div className="flex items-start gap-2">
                      <Trophy aria-hidden="true" className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <dl><dt className="font-medium text-slate-700">Guaranteed games</dt><dd>{event.guaranteed_games ?? 'Not confirmed'}</dd></dl>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <a href={`/tournaments/${event.slug}`} onClick={click => {
                      if (click.button === 0 && !click.metaKey && !click.ctrlKey && !click.shiftKey && !click.altKey) {
                        click.preventDefault();
                        navigate(`/tournaments/${event.slug}`);
                      }
                    }} className="px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
                      View Event Details
                    </a>
                    {registrationAvailable && (
                      <button type="button" onClick={() => onExternalClick(event.registration_url, event.title, 'external_registration_clicked')} className="px-3 py-2 text-sm font-semibold text-white bg-[#1463DF] rounded-lg flex items-center gap-1.5">
                        Official Registration <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                    {interestAvailable && <button type="button" onClick={() => setSelectedEvent(event)} className="px-3 py-2 text-sm font-semibold text-amber-950 bg-amber-100 rounded-lg hover:bg-amber-200">Express Interest</button>}
                    {event.lifecycle_state === 'registration-open' && !registrationAvailable && <span className="text-sm text-slate-600 self-center">Official registration details are not available.</span>}
                  </div>
                  <span className="text-xs text-slate-500">Deadline: {formatEventDate(event.registration_deadline, event.timezone)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedEvent && <EventInterestModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
