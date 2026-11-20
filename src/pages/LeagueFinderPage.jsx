import {track} from '../lib/analytics';
import {setMetadata} from '../lib/metadata';
import useDialog from '../components/useDialog';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, RotateCcw, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';
import LeagueCard from '../components/LeagueCard';
import FilterSidebar from '../components/FilterSidebar';
import { CardSkeletonGrid } from '../components/LoadingStates';

export default function LeagueFinderPage({ navigate, onExternalClick, initialQuery }) {
  const [leagues, setLeagues] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState(null);
  const [retry,setRetry]=useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const filterDialog=useDialog(mobileFilterOpen,()=>setMobileFilterOpen(false));

  const lastMetrics=useRef(null);
  // Initialize filters from URL search params
  function readFilters() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    return {
      offset: Math.max(0,Number(params.get('offset'))||0),
      season: params.get('season') || '',
      q,
      city: params.get('city') || '',
      category: params.get('category') || '',
      age: params.get('age') || '',
      night: params.get('night') || '',
      level: params.get('level') || '',
      reg: params.get('reg') || '',
      sport: params.has('sport') ? params.get('sport') : 'ice_hockey',
      sort: params.get('sort') || (q ? 'relevance' : 'name')
    };
  }
  const [filters,setFilterState]=useState(readFilters);
  function setFilters(next){
    let sort=next.sort||filters.sort;
    if(next.q&&!filters.q&&filters.sort==='name'&&next.sort===filters.sort)sort='relevance';
    if(!next.q&&filters.q&&filters.sort==='relevance'&&next.sort===filters.sort)sort='name';
    setFilterState({...next,sort,offset:0});
  }
  useEffect(()=>{const sync=()=>setFilterState(readFilters());window.addEventListener('popstate',sync);window.addEventListener('rinkcircuit:navigate',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('rinkcircuit:navigate',sync);};},[]);

  // Sync state to URL and fetch leagues
  useEffect(() => {
    const controller=new AbortController();
    const params = new URLSearchParams();
    if(filters.season)params.set('season',filters.season);
    if(filters.offset)params.set('offset',String(filters.offset));
    if (filters.q) params.set('q', filters.q);
    if (filters.city) params.set('city', filters.city);
    if (filters.category) params.set('category', filters.category);
    if (filters.age) params.set('age', filters.age);
    if (filters.night) params.set('night', filters.night);
    if (filters.level) params.set('level', filters.level);
    if (filters.reg) params.set('reg', filters.reg);
    if (filters.sport) params.set('sport', filters.sport);
    if (filters.sort && filters.sort !== (filters.q ? 'relevance' : 'name')) params.set('sort', filters.sort);

    const queryString = params.toString();
    const newRelativePathQuery = window.location.pathname + (queryString ? `?${queryString}` : '');
    window.history.replaceState(null, '', newRelativePathQuery);
    setMetadata('Adult Hockey League Finder | RinkCircuit',true);

    async function fetchLeagues() {
      setLoading(true);setError(null);
      try {
        const res = await fetch(`/api/leagues?${queryString}`,{signal:controller.signal});
        if(!res.ok)throw new Error('Unable to load leagues. Please retry.');
        const data = await res.json();
        if(controller.signal.aborted)return;
        const metricFilters=JSON.stringify({...filters,q:undefined,offset:undefined});
        if(filters.q&&lastMetrics.current?.q!==filters.q)track('search_submitted');
        if(lastMetrics.current&&lastMetrics.current.filters!==metricFilters)track('filter_applied');
        lastMetrics.current={q:filters.q,filters:metricFilters};
        setLeagues(data.data || []);
        setTotalMatches(data.pagination?.total || 0);
      } catch (err) {
        if(!controller.signal.aborted){setError(err.message);setLeagues([]);}
      } finally {
        if(!controller.signal.aborted)setLoading(false);
      }
    }

    const timer=setTimeout(fetchLeagues,200);
    return()=>{clearTimeout(timer);controller.abort();};
  }, [filters,retry]);

  function handleResetFilters() {
    setFilters({
      season:'',offset:0,q: '',
      city: '',
      category: '',
      age: '',
      night: '',
      level: '',
      reg: '',
      sport: 'ice_hockey',
      sort: 'name'
    });
  }

  const sponsoredLeagues = leagues.filter(league => Number(league.is_sponsored) === 1);
  const organicLeagues = leagues.filter(league => Number(league.is_sponsored) !== 1);
  function renderLeagueCards(items) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Page Title & Search Bar */}
      <div className="space-y-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 mb-2">
            <span>🏒 Live GTA League Catalogue</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Adult Hockey League Finder
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Search published adult recreational, commercial, and oldtimers leagues across the Greater Toronto Area.
          </p>
        </div>

        {/* Top Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex-1 flex items-center px-3.5 bg-slate-50/80 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              aria-label="Search leagues"
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search by league name, arena name, or municipal alias..."
              className="w-full text-xs sm:text-sm px-2.5 py-2.5 bg-transparent focus:outline-none placeholder:text-slate-400"
            />
            {filters.q && (
              <button
                aria-label="Clear search" onClick={() => setFilters({ ...filters, q: '' })}
                className="text-xs text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              aria-expanded={mobileFilterOpen} onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="lg:hidden px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filters ({totalMatches})</span>
            </button>

            <select
              aria-label="Sort leagues" value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="name">Sort: League Name (A-Z)</option>
              <option value="city">Sort: Municipality</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Filter Sidebar + Leagues List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            onReset={handleResetFilters}
            totalMatches={totalMatches}
          />
        </div>

        {/* Mobile Filter Drawer */}
        {mobileFilterOpen && (
          <div ref={filterDialog} role="dialog" aria-modal="true" aria-label="Filter leagues" tabIndex={-1} className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 p-4 flex justify-end">
            <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">Filter Leagues</span>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="text-xs text-slate-600 font-bold p-1"
                >
                  ✕ Close
                </button>
              </div>
              <FilterSidebar
                filters={filters}
                setFilters={setFilters}
                onReset={handleResetFilters}
                totalMatches={totalMatches}
              />
              <div className="pt-4">
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg text-xs"
                >
                  Apply Filters ({totalMatches} Results)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Listings Result Column */}
        <div className="lg:col-span-3 space-y-6">
          <p role="status" aria-live="polite" className="text-xs sm:text-sm font-semibold text-slate-600">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                <span>Searching verified GTA leagues...</span>
              </span>
            ) : error ? (
              'Search unavailable'
            ) : (
              `${totalMatches} matching adult hockey leagues found`
            )}
          </p>
          {error ? (
            <div role="alert" className="rounded-xl bg-white border border-red-200 p-6 space-y-2">
              <p className="text-sm text-red-700">{error}</p>
              <button className="text-xs font-bold underline text-blue-700" onClick={()=>setRetry(retry+1)}>Retry search</button>
            </div>
          ) : loading ? (
            <CardSkeletonGrid count={6} cols={2} />
          ) : leagues.length === 0 ? (
            // Acceptance A02: Empty state with clear filters and unmet demand form
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No leagues matched your active filters</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                We did not find any published leagues for the current criteria. We never fabricate missing leagues.
                You can clear your filters or register unmet local demand for your municipality.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear All Filters</span>
                </button>
                <button
                  onClick={() => navigate(`/request-a-league?q=${encodeURIComponent(filters.q || '')}&city=${encodeURIComponent(filters.city || '')}`)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition-colors flex items-center gap-1.5"
                >
                  <span>Request a League Here</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {sponsoredLeagues.length > 0 && (
                <section aria-label="Sponsored listings" className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-700">Sponsored listings</h2>
                  {renderLeagueCards(sponsoredLeagues)}
                </section>
              )}
              {organicLeagues.length > 0 && (
                <section aria-label="Directory listings" className="space-y-3">
                  {sponsoredLeagues.length > 0 && <h2 className="text-sm font-bold text-slate-700">Directory listings</h2>}
                  {renderLeagueCards(organicLeagues)}
                </section>
              )}
            </div>
          )}
          {!loading&&!error&&totalMatches>50&&<nav aria-label="Result pages" className="flex gap-4 items-center"><button disabled={!filters.offset} onClick={()=>setFilterState({...filters,offset:Math.max(0,(filters.offset||0)-50)})}>Previous</button><span>Page {Math.floor((filters.offset||0)/50)+1} of {Math.ceil(totalMatches/50)}</span><button disabled={(filters.offset||0)+50>=totalMatches} onClick={()=>setFilterState({...filters,offset:(filters.offset||0)+50})}>Next</button></nav>}
        </div>
      </div>
    </div>
  );
}
