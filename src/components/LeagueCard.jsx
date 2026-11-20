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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
      <div className="p-5">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${status.bg}`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>

          <div className="flex items-center gap-1.5">
            {league.sport_type === 'ball_hockey' ? (
              <span className="text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">
                Ball Hockey
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Ice Hockey
              </span>
            )}
            {isSponsored && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
                Sponsored
              </span>
            )}
          </div>
        </div>

        {/* League Title & Category */}
        <h3 className="text-lg font-bold leading-snug mb-1">
          <a href={`/leagues/${league.slug}`} onClick={handleProfileClick} className="text-slate-900 group-hover:text-blue-600 transition-colors">
            {league.name}
          </a>
        </h3>
        <p className="text-xs text-blue-700 font-medium mb-3">
          {league.category || 'Category not confirmed'}
        </p>

        {/* Location & Arenas */}
        <div className="space-y-1.5 text-xs text-slate-600 mb-4">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="font-medium text-slate-800">{league.area || 'Area not confirmed'}</span>
            <span className="text-slate-600">({league.municipality || 'Municipality not confirmed'})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>{nightsText}</span>
            {primaryOffering.season_label && (
              <span className="text-slate-600">• {primaryOffering.season_label}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">
              {primaryOffering.skill_labels || 'Not confirmed'}
            </span>
          </div>
        </div>

        {/* Fee preview */}
        <div className="bg-slate-50 rounded-lg p-2.5 text-xs border border-slate-100 mb-2">
          <div className="flex justify-between items-center text-slate-600 mb-0.5">
            <span>Registration Mode</span>
            <span className="font-medium text-slate-800">{primaryOffering.registration_modes || 'Not confirmed'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Fee</span>
            <span className="font-semibold text-slate-900">{feeDisplay}</span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <a
          href={`/leagues/${league.slug}`}
          onClick={handleProfileClick}
          className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          View Profile & Details →
        </a>

        {primaryOffering.registration_url && (
          <button
            onClick={() => onExternalClick(primaryOffering.registration_url, league.name, 'external_registration_clicked')}
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1 transition-colors"
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
