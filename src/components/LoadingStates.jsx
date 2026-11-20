import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full page or route level loading indicator (used as Suspense fallback and route transitions)
 */
export function PageLoader({ message = "Loading RinkCircuit..." }) {
  return (
    <div role="status" aria-live="polite" className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative flex items-center justify-center">
        {/* Glowing backdrop halo */}
        <div className="absolute w-20 h-20 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
        {/* Outer spinning ring */}
        <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
        {/* Inner ice puck icon */}
        <div className="absolute text-xl select-none animate-bounce">
          🏒
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-slate-800 tracking-tight">{message}</p>
        <p className="text-xs text-slate-600">Retrieving verified GTA adult hockey data</p>
      </div>
      <span className="sr-only">{message}</span>
    </div>
  );
}

/**
 * Shimmering skeleton grid matching LeagueCard and Directory layouts
 */
export function CardSkeletonGrid({ count = 6, cols = 3 }) {
  const colClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div role="status" aria-live="polite" className={`grid ${colClass} gap-6`}>
      <span className="sr-only">Loading listings…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 animate-pulse overflow-hidden"
        >
          <div className="space-y-4">
            {/* Top Badges */}
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 bg-slate-200 rounded-full"></div>
              <div className="h-5 w-20 bg-slate-200 rounded-full"></div>
            </div>

            {/* Title & Category */}
            <div className="space-y-2">
              <div className="h-6 w-3/4 bg-slate-200 rounded-lg"></div>
              <div className="h-3 w-1/3 bg-slate-100 rounded"></div>
            </div>

            {/* Metadata Rows */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
                <div className="h-3.5 w-1/2 bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
                <div className="h-3.5 w-2/3 bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
                <div className="h-3.5 w-2/5 bg-slate-200 rounded"></div>
              </div>
            </div>

            {/* Fee Preview Box */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
              <div className="h-3 w-full bg-slate-200 rounded"></div>
              <div className="h-3.5 w-2/3 bg-slate-200 rounded"></div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="h-4 w-28 bg-slate-200 rounded"></div>
            <div className="h-4 w-16 bg-slate-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Inline spinning loader for small sections, search bars or modals
 */
export function InlineSpinner({ message = "Loading...", size = "md" }) {
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2.5 py-6 text-slate-700">
      <Loader2 className={`${iconSize} animate-spin text-blue-600 shrink-0`} />
      <span className="text-xs sm:text-sm font-medium">{message}</span>
    </div>
  );
}

/**
 * Profile detail page skeleton (used in LeagueProfilePage, TeamProfilePage, EventDetailPage)
 */
export function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <span className="sr-only">Loading details…</span>
      <div className="h-4 w-32 bg-slate-200 rounded"></div>
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 w-36 bg-slate-200 rounded-full"></div>
          <div className="h-7 w-44 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="h-9 w-2/3 bg-slate-200 rounded-lg"></div>
        <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
        <div className="h-16 w-full bg-slate-100 rounded-xl"></div>
        <div className="h-12 w-64 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="h-6 w-48 bg-slate-200 rounded"></div>
            <div className="h-24 w-full bg-slate-100 rounded-xl"></div>
            <div className="h-24 w-full bg-slate-100 rounded-xl"></div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="h-5 w-32 bg-slate-200 rounded"></div>
            <div className="h-16 w-full bg-slate-100 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
