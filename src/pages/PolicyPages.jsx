import React, {useState} from 'react';
import { Shield, FileText, Mail } from 'lucide-react';

export function PrivacyPage() {
  const [analytics,setAnalytics]=useState(()=>{try{return localStorage.getItem('rinkcircuit_analytics_consent')==='true';}catch{return false;}});
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <label className="block rounded border bg-white p-4 text-sm"><input type="checkbox" checked={analytics} onChange={event=>{setAnalytics(event.target.checked);try{localStorage.setItem('rinkcircuit_analytics_consent',String(event.target.checked));}catch{}}} /> Allow optional usage counters. No search text, contact information or visitor identifier is included. You can withdraw here at any time.</label>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Privacy Notice</h1>
          <p className="text-xs text-slate-700">Official RinkCircuit data protection and privacy policy</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 text-xs text-slate-700 leading-relaxed">
        <p><strong>Effective Date:</strong> November 5, 2026 • Version 1.0</p>
        <p>
          Plaionn Sports Group operates the RinkCircuit as an independent discovery tool for adult hockey players, captains, and league operators across the Greater Toronto Area.
        </p>
        <h3 className="font-bold text-slate-900 text-sm pt-2">1. Information We Collect</h3>
        <p>
          We collect personal information solely when voluntarily submitted through our forms (such as Captain's Club submissions, tournament interest, unmet demand requests, and listing correction reports). This includes name, email, role, and municipality.
        </p>
        <h3 className="font-bold text-slate-900 text-sm pt-2">2. Strict Isolation of Private Contact Records</h3>
        <p>
          Under our Phase 1 operational specification, captain emails, phone numbers, and private outreach notes are strictly isolated on server-side databases. They are never rendered in public web pages, API endpoints, or search index payloads.
        </p>
        <h3 className="font-bold text-slate-900 text-sm pt-2">3. Canadian Anti-Spam Legislation (CASL) Compliance</h3>
        <p>
          Consent to receive transactional service communications regarding an explicit inquiry is completely decoupled from marketing opt-in. Marketing checkboxes are unchecked by default. You may withdraw marketing consent at any time.
        </p>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Terms of Service & Directory Disclaimers</h1>
          <p className="text-xs text-slate-700">Listing guidelines, governance, and directory disclosures</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 text-xs text-slate-700 leading-relaxed">
        <p><strong>Last Updated:</strong> November 5, 2026</p>
        <p>
          The RinkCircuit is a curated directory provided for general informational purposes.
        </p>
        <h3 className="font-bold text-slate-900 text-sm pt-2">1. Independent League Governance</h3>
        <p>
          Unless explicitly designated with a "Plaionn Partner" or Plaionn-operated disclosure, listings represent independent third-party leagues, arena facilities, and municipalities. Official schedules, fees, waivers, and player insurance are governed exclusively by each respective league operator.
        </p>
        <h3 className="font-bold text-slate-900 text-sm pt-2">2. Data Provenance & No Guaranteed Availability</h3>
        <p>
          Listing details (nights, skill tiers, fees) are compiled from publicly crawled official websites and municipal ice allocation filings. Where fees or openings are unconfirmed, they are labeled honestly. Listing inclusion does not guarantee team placement or roster spots.
        </p>
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Support & Contact</h1>
          <p className="text-xs text-slate-700">Get in touch with the RinkCircuit team and directory editors</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 text-xs text-slate-700 leading-relaxed">
        <p>
          Have questions about the directory, need to report an error, or want to discuss tournament partnerships?
        </p>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
          <div>
            <strong className="text-slate-900">Editorial & Support Inbox:</strong>
            <div className="text-blue-600 font-mono text-sm">support@plaionn.com</div>
          </div>
          <div>
            <strong className="text-slate-900">League Operator Partnerships & Listings:</strong>
            <div className="text-blue-600 font-mono text-sm">convenor@plaionn.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}
