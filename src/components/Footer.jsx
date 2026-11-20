import React from 'react';

export default function Footer({ navigate }) {
  return (
    <footer className="bg-[#0B131E] text-slate-400 border-t border-slate-800/80 text-sm mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & Purpose */}
          <div className="space-y-3.5 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
                🏒
              </div>
              <span className="font-extrabold text-white text-base tracking-tight">RinkCircuit GTA</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Greater Toronto's curated adult hockey directory. Connecting players, captains, and independent convenors across the GTA.
            </p>
            <div className="pt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>44 Verified GTA Leagues Active</span>
            </div>
          </div>

          {/* Player & Captain Tools */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">Directory & Teams</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => navigate('/leagues')} className="hover:text-sky-400 transition-colors">
                  Find a League (All GTA)
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/teams')} className="hover:text-sky-400 transition-colors">
                  Approved Teams Directory
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/captains')} className="hover:text-sky-400 transition-colors">
                  Captain's Club & Registration
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/tournaments')} className="hover:text-sky-400 transition-colors">
                  Tournaments & Events
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/request-a-league')} className="hover:text-sky-400 transition-colors">
                  Request a League
                </button>
              </li>
            </ul>
          </div>

          {/* Curated City Guides */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">GTA Hubs</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => navigate('/locations/on/toronto')} className="hover:text-sky-400 transition-colors">
                  Toronto Leagues
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/locations/on/vaughan')} className="hover:text-sky-400 transition-colors">
                  Vaughan / Sports Village
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/locations/on/mississauga')} className="hover:text-sky-400 transition-colors">
                  Mississauga & CMAHL
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/locations/on/brampton')} className="hover:text-sky-400 transition-colors">
                  Brampton / CAA Centre
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/locations/on/whitby')} className="hover:text-sky-400 transition-colors">
                  Whitby & Iroquois Park
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/locations/on/markham')} className="hover:text-sky-400 transition-colors">
                  Markham & Richmond Hill
                </button>
              </li>
            </ul>
          </div>

          {/* Operators & Governance */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">Convenors & Legal</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => navigate('/operators')} className="hover:text-sky-400 transition-colors">
                  For League Operators
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/listing-request')} className="hover:text-sky-400 transition-colors">
                  Submit or Claim Listing
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/privacy')} className="hover:text-sky-400 transition-colors">
                  Privacy Notice
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/terms')} className="hover:text-sky-400 transition-colors">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/contact')} className="hover:text-sky-400 transition-colors">
                  Support & Inquiries
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Ownership Disclosure & Acceptance Note */}
        <div className="pt-8 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-center md:text-left leading-relaxed">
            © 2026 Plaionn Sports Group. All rights reserved. RinkCircuit operates independently to index GTA adult hockey.
            Third-party leagues maintain their own registrations and governance.
          </p>
          <div className="flex items-center space-x-3 text-xs text-slate-400 shrink-0">
            <span>RinkCircuit v1.0</span>
            <span>•</span>
            <button onClick={() => navigate('/admin')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Admin Console
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
