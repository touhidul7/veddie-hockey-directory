import React from 'react';
import { ShieldCheck, Calendar, MapPin, Award, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

export default function LeagueCard({ league, onSelect, onExternalClick }) {
  const primaryOffering = (league.offerings && league.offerings[0]) || {};
  const nights = primaryOffering.nights || [];
  const nightsText = nights.length > 0 ? nights.join(', ') : 'Not confirmed';
  const feeAmount = primaryOffering.fee_amount;
  const feeDisplay = feeAmount === null || feeAmount === undefined
    ? 'Not confirmed'
    : `${primaryOffering.fee_currency ? `${primaryOffering.fee_currency} ` : ''}$${Number(feeAmount).toLocaleString()}${primaryOffering.fee_unit ? ` (${primaryOffering.fee_unit})` : ''}`;

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

  function handleProfileClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(league.slug);
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

          <div className="flex items-center gap-1.5">
            {league.sport_type === 'ball_hockey' ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200/80">
                Ball Hockey
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200/80">
                Ice Hockey
              </span>
            )}
            {isSponsored && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                Featured
              </span>
            )}
          </div>
        </div>

        {/* League Title & Category */}
        <h3 className="text-lg font-bold leading-snug mb-1.5">
          <a href={`/leagues/${league.slug}`} onClick={handleProfileClick} className="text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {league.name}
          </a>
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
        </div>

        {/* Fee preview */}
        <div className="bg-slate-50/90 rounded-xl p-3 text-xs border border-slate-100">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span>Registration Mode</span>
            <span className="font-semibold text-slate-700">{primaryOffering.registration_modes || 'Team & Individual'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>Estimated Fee</span>
            <span className="font-bold text-slate-900">{feeDisplay}</span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <a
          href={`/leagues/${league.slug}`}
          onClick={handleProfileClick}
          className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/btn transition-colors"
        >
          <span>View League Details</span>
          <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
        </a>

        {primaryOffering.registration_url && (
          <button
            onClick={() => onExternalClick(primaryOffering.registration_url, league.name, 'external_registration_clicked')}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors"
            title="External official league website"
          >
            <span>Official Link</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
