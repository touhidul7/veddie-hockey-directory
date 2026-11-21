import React, { useState, useEffect } from 'react';
import { Search, Trophy, Users, Shield, ArrowRight, MapPin, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import LeagueCard from '../components/LeagueCard';
import { CardSkeletonGrid, InlineSpinner } from '../components/LoadingStates';

function formatEventDate(value) {
  if (!value) return 'Dates not confirmed';
  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return 'Dates not confirmed';
  const date = new Date(`${datePart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Dates not confirmed';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function HomePage({ navigate, onExternalClick }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [featuredLeagues, setFeaturedLeagues] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retry, setRetry] = useState(0);

  const popularCities = ['Toronto', 'Vaughan', 'Mississauga', 'Brampton', 'Markham', 'Whitby', 'Oakville'];
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = tournaments.filter(event =>
    !['completed', 'cancelled'].includes(event.lifecycle_state) &&
    (!event.start_date || String(event.start_date).slice(0, 10) >= today)
  ).slice(0, 3);
  const sponsoredFeatured = featuredLeagues.filter(league => Number(league.is_sponsored) === 1);
  const organicFeatured = featuredLeagues.filter(league => Number(league.is_sponsored) !== 1);

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [leaguesRes, tournamentsRes] = await Promise.all([
          fetch('/api/leagues?limit=6&sort=relevance&sport=ice_hockey'),
          fetch('/api/events?limit=3')
        ]);
        if (!leaguesRes.ok || !tournamentsRes.ok) throw new Error('Unable to load current directory data.');
        const leaguesData = await leaguesRes.json();
        const tournamentsData = await tournamentsRes.json();

        setFeaturedLeagues(leaguesData.data || []);
        setTournaments(tournamentsData.data || []);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
        setLoadError('Unable to load current directory data. Please retry.');
      } finally {
        setLoading(false);
      }
    }
    setLoadError(null);
    setLoading(true);
    loadHomeData();
  }, [retry]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCity) params.set('city', selectedCity);
    navigate(`/leagues?${params.toString()}`);
  }

  function renderFeaturedCards(items) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(league => (
          <LeagueCard
            key={league.id}
            league={league}
            onSelect={slug => navigate(`/leagues/${slug}`)}
            onExternalClick={onExternalClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#0B131E] via-[#111D2B] to-[#0F172A] text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80 relative overflow-hidden">
        {/* Subtle ice background glow and radial mesh */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:24px_24px]"></div>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 text-blue-300 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide shadow-sm shadow-blue-500/10">
            <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>Greater Toronto Area • Verified Hockey Directory</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Your next great season <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
              starts right here.
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Discover verified adult ice and ball hockey leagues, connect with approved teams, and explore local tournaments across the Greater Toronto Area.
          </p>

          {/* Quick Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="bg-white/95 backdrop-blur-md p-2.5 sm:p-3.5 rounded-2xl shadow-2xl shadow-black/40 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2.5 text-slate-900 border border-white/20 ring-1 ring-black/5"
          >
            <div className="flex-1 flex items-center px-3.5 bg-slate-50 rounded-xl border border-slate-200/90 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search league name, arena, or division..."
                className="w-full text-xs sm:text-sm px-2.5 py-2.5 sm:py-3 bg-transparent focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="sm:w-48 flex items-center px-3 bg-slate-50 rounded-xl border border-slate-200/90 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <select aria-label="Choose a city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full text-xs sm:text-sm py-2.5 sm:py-3 bg-transparent focus:outline-none text-slate-800 font-medium cursor-pointer"
              >
                <option value="">All GTA Cities</option>
                {popularCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <span>Find Leagues</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-extrabold text-sky-400">44+</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Verified Leagues</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-extrabold text-blue-400">11</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">GTA Hubs</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">100%</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Curated Data</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center backdrop-blur-xs">
              <div className="text-xl sm:text-2xl font-extrabold text-indigo-400">Free</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Community Directory</div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular GTA Municipalities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Municipal Hubs</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">Explore by Municipality</h2>
            <p className="text-xs sm:text-sm text-slate-600">Select a city to browse local arenas, offerings, and league contacts.</p>
          </div>
          <button
            onClick={() => navigate('/leagues')}
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
          >
            <span>View All 44 GTA Leagues</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {popularCities.map((city) => (
            <button
              key={city}
              onClick={() => navigate(`/locations/on/${city.toLowerCase()}`)}
              className="p-3.5 bg-white rounded-xl border border-slate-200/90 hover:border-blue-500 hover:shadow-md text-left transition-all group card-hover-lift"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">{city}</span>
                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <div className="text-[11px] text-slate-500 group-hover:text-slate-700">Explore guide →</div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured GTA Leagues */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Featured Adult Hockey Leagues</h2>
            <p className="text-xs text-slate-600">Browse published adult hockey programme listings across the GTA.</p>
          </div>
          <button
            onClick={() => navigate('/leagues')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>Browse All Leagues</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <CardSkeletonGrid count={6} cols={3} />
        ) : loadError ? (
          <div role="alert" className="bg-white border border-red-200 rounded-xl p-5 text-sm text-red-800">
            {loadError} <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Retry</button>
          </div>
        ) : featuredLeagues.length === 0 ? (
          <p className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-600">No published league listings are currently available.</p>
        ) : (
          <div className="space-y-6">
            {sponsoredFeatured.length > 0 && (
              <section aria-label="Sponsored listings" className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Sponsored listings</h3>
                {renderFeaturedCards(sponsoredFeatured)}
              </section>
            )}
            {organicFeatured.length > 0 && (
              <section aria-label="Directory listings" className="space-y-3">
                {sponsoredFeatured.length > 0 && <h3 className="text-sm font-bold text-slate-700">Directory listings</h3>}
                {renderFeaturedCards(organicFeatured)}
              </section>
            )}
          </div>
        )}
      </section>

      {/* Published events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Published Tournaments & Events</h2>
            <p className="text-xs text-slate-600">Dates, prices and registration details are shown only when confirmed.</p>
          </div>
          <button type="button" onClick={() => navigate('/tournaments')} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            Explore Events →
          </button>
        </div>
        {loading ? (
          <InlineSpinner message="Loading published tournaments & events..." />
        ) : loadError ? (
          <div role="alert" className="bg-white border border-red-200 rounded-xl p-5 text-sm text-red-800">
            {loadError} <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Retry</button>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
            No upcoming events are currently published. Check back for updates.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingEvents.map(event => (
              <article key={event.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-slate-900">{event.title}</h3>
                <p className="text-sm text-slate-600">{formatEventDate(event.start_date)} · {event.location_name || event.city || 'Location not confirmed'}</p>
                <button type="button" onClick={() => navigate(`/tournaments/${event.slug}`)} className="text-sm font-semibold text-blue-700 underline">
                  View event details
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Captain's Club Value Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Captain's Club</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Less organizing. More hockey.
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Captain's Club is an interest programme for adult hockey captains. Submit your team for review and tell us which published events may interest you.
            </p>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Team profiles are published only after admin review and approval</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Event interest does not guarantee entry or reserve a place</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Captain contact details remain private; email verification is required</span>
              </li>
            </ul>
            <div className="pt-2">
              <button
                onClick={() => navigate('/captains')}
                className="bg-[#1463DF] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition-colors flex items-center gap-1.5"
              >
                <span>Register Your Team Interest</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Approved Public Team Directory</h3>
            <p className="text-xs text-slate-600">
              Only teams approved by RinkCircuit appear here. Public profiles do not expose captain contact details or player information.
            </p>
            <button
              onClick={() => navigate('/teams')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 block text-right w-full"
            >
              Browse all approved teams →
            </button>
          </div>
        </div>
      </section>

      {/* For League Operators Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#12202B] text-white rounded-2xl p-6 sm:p-10 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 shadow-lg">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">For League Operators</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Keep your league. Give your teams more to play for.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We do not compete with independent league convenors. RinkCircuit provides free discovery, recruitment referral traffic, and a championship pathway that gives your division winners something bigger to contest at season's end.
            </p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/operators')}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition-colors"
            >
              Operator Proposition
            </button>
            <button
              onClick={() => navigate('/listing-request')}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-xl border border-slate-700 transition-colors"
            >
              Claim or Submit a Listing
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
