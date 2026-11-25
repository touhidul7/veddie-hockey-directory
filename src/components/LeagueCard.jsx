import React from 'react';
import { ShieldCheck, Calendar, MapPin, Award, CheckCircle2, AlertCircle, ArrowUpRight, Globe } from 'lucide-react';

function formatDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

export default function LeagueCard({ league, onExternalClick }) {
  const primaryOffering = (league.offerings && league.offerings[0]) || {};
  const nights = primaryOffering.nights || [];
  const nightsText = nights.length > 0 ? nights.join(', ') : 'Not confirmed';
  const websiteUrl = league.website_url || primaryOffering.registration_url || null;

  // Verification badge
  const statusConfig = {
    operator_confirmed: {
      label: 'Operator Confirmed',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: CheckCircle2
    },
    research_checked: {
      label: 'Research Checked',
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: ShieldCheck
    },
    needs_review: {
      label: 'Needs Review',
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: AlertCircle
    }
  };

  const status = statusConfig[league.verification_status] || statusConfig.needs_review;
  const StatusIcon = status.icon;
  const isSponsored = Number(league.is_sponsored) === 1;

  function handleWebsiteClick(e) {
    if (onExternalClick && websiteUrl) {
      onExternalClick(websiteUrl, league.name, 'website_clicked');
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-400/60 card-hover-lift transition-all flex flex-col justify-between overflow-hidden group">
      <div className="p-5 sm:p-6">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-2xs ${status.bg}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </span>

          {isSponsored && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
              Featured
            </span>
          )}
        </div>

        {/* League Title & Category */}
        <h3 className="text-lg font-bold leading-snug mb-1.5 text-slate-900">
          {league.name}
        </h3>
        <p className="text-xs font-semibold text-blue-600 mb-4 tracking-wide uppercase">
          {league.category || 'Adult Hockey Programme'}
        </p>

        {/* Location & Arenas */}
        <div className="space-y-2 text-xs text-slate-600 mb-4.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
              <MapPin className="w-3 h-3 text-slate-500" />
            </div>
            <span className="font-semibold text-slate-800">{league.area || 'Area not confirmed'}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{league.municipality || 'Greater Toronto Area'}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
              <Calendar className="w-3 h-3 text-slate-500" />
            </div>
            <span className="text-slate-700 font-medium">{nightsText}</span>
            {primaryOffering.season_label && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{primaryOffering.season_label}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
              <Award className="w-3 h-3 text-slate-500" />
            </div>
            <span className="truncate text-slate-700">
              {primaryOffering.skill_labels || 'All Skill Divisions'}
            </span>
          </div>

          {websiteUrl && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Globe className="w-3 h-3" />
              </div>
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWebsiteClick}
                className="text-blue-600 hover:text-blue-800 font-medium truncate underline decoration-blue-200 underline-offset-2"
                title={websiteUrl}
              >
                {formatDomain(websiteUrl)}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">Official Website</span>

        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWebsiteClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.02]"
          >
            <span>Visit Website</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span className="text-slate-400 italic">No link verified</span>
        )}
      </div>
    </div>
  );
}
