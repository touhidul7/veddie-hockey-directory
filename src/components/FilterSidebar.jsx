import React from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';

export default function FilterSidebar({ filters, setFilters, onReset, totalMatches }) {
  const municipalities = [
    'Toronto', 'Vaughan', 'Brampton', 'Mississauga', 'Markham',
    'Richmond Hill', 'Whitby', 'Oakville', 'Burlington', 'Oshawa', 'Newmarket'
  ];

  const nights = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


  function toggleCity(city) {
    const current = filters.city ? filters.city.split(',').map(c => c.trim()).filter(Boolean) : [];
    let updated;
    if (current.includes(city)) {
      updated = current.filter(c => c !== city);
    } else {
      updated = [...current, city];
    }
    setFilters({ ...filters, city: updated.join(',') });
  }

  function hasActiveFilters() {
    return !!(filters.q || filters.city || filters.night || filters.level || filters.reg || filters.sport !== 'ice_hockey' || filters.season || filters.category || filters.age);
  }

  return (
    <aside className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-6">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Filter Leagues</h3>
        </div>

        {hasActiveFilters() && (
          <button
            onClick={onReset}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Results Count Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 text-blue-900 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center justify-between border border-blue-100/80">
        <span className="font-medium text-slate-700">Matching Listings:</span>
        <span className="font-extrabold text-blue-600 text-sm bg-white px-2 py-0.5 rounded-md shadow-2xs">{totalMatches}</span>
      </div>

      {/* Sport Category Switcher */}
      <div>
        <div className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Sport Type</div>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-xl" role="group" aria-label="Sport type">
          <button
            type="button"
            aria-pressed={filters.sport === 'all'}
            onClick={() => setFilters({ ...filters, sport: 'all' })}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
              filters.sport === 'all' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Sports
          </button>
          <button
            type="button"
            aria-pressed={filters.sport === 'ice_hockey'}
            onClick={() => setFilters({ ...filters, sport: 'ice_hockey' })}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
              filters.sport === 'ice_hockey'
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ice Hockey
          </button>
          <button
            type="button"
            aria-pressed={filters.sport === 'ball_hockey'}
            onClick={() => setFilters({ ...filters, sport: 'ball_hockey' })}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
              filters.sport === 'ball_hockey'
                ? 'bg-white text-orange-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ball Hockey
          </button>
        </div>
      </div>

      <label className="block text-xs font-bold text-slate-700">
        Programme Category
        <input className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl p-2.5 mt-1.5 font-normal text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400" value={filters.category || ''} onChange={e => setFilters({ ...filters, category: e.target.value })} placeholder="e.g. Adult recreational, Corporate" />
      </label>
      <label className="block text-xs font-bold text-slate-700">
        Age Eligibility
        <input className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl p-2.5 mt-1.5 font-normal text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400" value={filters.age || ''} onChange={e => setFilters({ ...filters, age: e.target.value })} placeholder="e.g. 19+, 30+, 35+" />
      </label>

      {/* Municipality / Area */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          GTA Municipality
        </label>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {municipalities.map((city) => {
            const activeCities = filters.city ? filters.city.split(',').map(c => c.trim()) : [];
            const isChecked = activeCities.includes(city);
            return (
              <label
                key={city}
                className={`flex items-center space-x-2 text-xs cursor-pointer select-none py-1.5 px-2 rounded-lg transition-colors ${
                  isChecked ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCity(city)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>{city}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Playing Nights */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Playing Night
        </label>
        <div className="flex flex-wrap gap-1.5">
          {nights.map((n) => {
            const isSelected = filters.night === n;
            return (
              <button
                type="button"
                key={n}
                onClick={() => setFilters({ ...filters, night: isSelected ? '' : n })}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {n.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-xs font-bold text-slate-700">Season
        <input className="block w-full border rounded p-2 mt-2" value={filters.season||''} onChange={e=>setFilters({...filters,season:e.target.value})} placeholder="e.g. Winter 2026/27" />
      </label>
      <label className="block text-xs font-bold text-slate-700">Operator's level or division label
        <input className="block w-full border rounded p-2 mt-2" value={filters.level||''} onChange={e=>setFilters({...filters,level:e.target.value})} placeholder="Use the league's own label" />
        <span className="font-normal">Labels are not equivalent across leagues.</span>
      </label>

      {/* Registration Mode */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Registration Format
        </label>
        <div className="space-y-1 text-xs">
          {[
            { label: 'All Formats', val: '' },
            { label: 'Individual entry', val: 'Individual' },
            { label: 'Full Team Entry', val: 'Team' }
          ].map((mode) => (
            <button
              type="button"
              key={mode.val}
              onClick={() => setFilters({ ...filters, reg: mode.val })}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                filters.reg === mode.val
                  ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
