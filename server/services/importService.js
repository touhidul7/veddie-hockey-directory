const crypto = require('crypto');
const { getDb } = require('../db/database');
const { sourceReviewFor } = require('./sourceReview');
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const slugify = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function sourceUrls(value) {
  return String(value || '').split(/[\s,;]+/).filter(Boolean).filter(value => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  });
}
async function previewAndStageBatch(filename, sourceName, rows) {
  const db = getDb();
  return db.transaction(async () => {
    const batchId = `batch_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await db.run(`INSERT INTO rinkcircuit.import_batches
      (id, filename, source_name, total_rows, approved_rows, status, created_at)
      VALUES (?, ?, ?, ?, 0, 'staged', ?)`, batchId, filename, sourceName, rows.length, now);
    const existing = await db.all('SELECT id, name, area, category, version, verification_status FROM rinkcircuit.league_programmes');
    const stagedRows = [];
    const seen = new Set();
    for (const [index, row] of rows.entries()) {
      const name = String(row.League || row.name || row['Programme Name'] || '').trim();
      const area = String(row.Area || row.area || row.City || '').trim();
      const category = String(row.Category || row.category || '').trim();
      const source = String(row.Source || row.source || row.url || '').trim();
      const notes = String(row['Attached research notes'] || row.notes || '');
      const rowKey = hash(`${normalize(name)}|${normalize(area)}`);
      const matches = existing.filter(p => normalize(p.name) === normalize(name) && normalize(p.area) === normalize(area));
      const match = matches.length === 1 ? matches[0] : null;
      const flags = [];
      if (!name || !area || !category) flags.push('missing_fields');
      if (!sourceUrls(source).length) flags.push('invalid_source');
      if (/h\.e\.t\.i\.|applicant|ice-allocation-entitlements|unresolved applicant/i.test([name, category, source, notes].join(' '))) flags.push('applicant_lead');
      if (matches.length || seen.has(rowKey)) flags.push('duplicate_candidate');
      if (matches.length > 1 || seen.has(rowKey)) flags.push('ambiguous_match');
      if (match?.verification_status === 'operator_confirmed') flags.push('operator_confirmed_conflict');
      seen.add(rowKey);
      const id = `row_${batchId}_${index + 1}`;
      const raw = { ...row, _existingId: match?.id || null, _existingVersion: match?.version || null };
      await db.run(`INSERT INTO rinkcircuit.import_rows
        (id,batch_id,row_key,raw_data_json,candidate_programme_name,candidate_area,candidate_category,evidence_url,flags,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,'pending_review',?)`, id,batchId,rowKey,JSON.stringify(raw),name,area,category,source,JSON.stringify(flags),now);
      stagedRows.push({ id, batchId, rowKey, candidateName: name, candidateArea: area, candidateCategory: category,
        evidenceUrl: source, flags, existingMatch: match ? { id: match.id, name: match.name, verification: match.verification_status } : null,
        conflictInfo: match?.verification_status === 'operator_confirmed' ? { message: 'Operator-confirmed fields require separate editorial review.' } : null });
    }
    return getBatchReview(batchId);
  });
}
async function commitStagedBatch(batchId, approvedRowIds, actor = 'admin', versions) {
  const db = getDb();
  return db.transaction(async () => {
    await db.get('SELECT pg_advisory_xact_lock(826412906)');
    const batch = await db.get('SELECT * FROM rinkcircuit.import_batches WHERE id = ? FOR UPDATE', batchId);
    if (!batch) throw new Error('Import batch not found');
    const rows = await db.all('SELECT * FROM rinkcircuit.import_rows WHERE batch_id = ?', batchId);
    if (approvedRowIds.some(id => !rows.some(row => row.id === id))) throw new Error('Selected row does not belong to this batch');
    let createdCount = 0, updatedCount = 0, skippedCount = 0;
    const now = new Date().toISOString();
    for (const row of rows.filter(row => approvedRowIds.includes(row.id))) {
      if (versions && versions[row.id] !== row.review_version) { const error=new Error('Staged row changed. Reload the preview.');error.status=409;throw error; }
      const flags = JSON.parse(row.flags || '[]');
      if(rows.some(other=>other.id!==row.id&&other.status==='pending_review'&&other.row_key===row.row_key)){skippedCount++;continue;}
      if (row.status !== 'pending_review' || !sourceUrls(row.evidence_url).length || flags.some(flag => ['missing_fields','invalid_source','ambiguous_match','operator_confirmed_conflict','editorial_hold'].includes(flag))) { skippedCount++; continue; }
      const raw = JSON.parse(row.raw_data_json);
      const current = raw._existingId ? await db.get('SELECT * FROM rinkcircuit.league_programmes WHERE id = ? FOR UPDATE', raw._existingId) : null;
      // Existing researched/manual records are not overwritten by an import.
      if (current || raw._existingId) {
        skippedCount++;
        await db.run("UPDATE rinkcircuit.import_rows SET status = 'skipped' WHERE id = ?", row.id);
        continue;
      }
      const id = `prog_imp_${row.row_key}`;
      const candidates = await db.all('SELECT id,name,area FROM rinkcircuit.league_programmes');
      const duplicate = candidates.find(item => item.id === id || (normalize(item.name) === normalize(row.candidate_programme_name) && normalize(item.area) === normalize(row.candidate_area)));
      if (duplicate) { skippedCount++; await db.run("UPDATE rinkcircuit.import_rows SET status = 'skipped' WHERE id = ?",row.id); continue; }
      const slug = `${slugify(row.candidate_programme_name)}-${row.row_key.slice(0,8)}`;
      const originalSource = String(raw.Source || raw.source || raw.url || '').trim();
      const checked = row.evidence_url === originalSource ? raw['Checked on'] || raw.checked_at : null;
      const checkedAt = typeof checked === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checked) && !Number.isNaN(Date.parse(checked)) ? new Date(checked).toISOString() : null;
      const draftOnly = flags.includes('applicant_lead') || flags.includes('publication_hold');
      await db.run(`INSERT INTO rinkcircuit.league_programmes
        (id,name,slug,area,municipality,category,sport_type,publication_status,verification_status,version,last_checked_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?, ?,?,1,?,?,?)`, id,row.candidate_programme_name,slug,row.candidate_area,
        row.candidate_area,row.candidate_category,/ball/i.test(row.candidate_category)?'ball_hockey':'ice_hockey',
        draftOnly?'draft':'published',draftOnly?'unverified':'research_checked',checkedAt,now,now);
      // Unknown season, night, skill, fee and availability remain unknown.
      await db.run(`INSERT INTO rinkcircuit.season_offerings
        (id,programme_id,season_label,registration_status,created_at,updated_at)
        VALUES (?,?, 'Not confirmed','unknown',?,?)`, `off_${id}`,id,now,now);
      for (const [index,url] of sourceUrls(row.evidence_url).entries()) {
        await db.run(`INSERT INTO rinkcircuit.source_evidence
          (id,programme_id,url,source_type,checked_at,evidence_summary,created_at)
          VALUES (?,?,?,'workbook_import',?,'Source supplied in reviewed research workbook.',?)`, `ev_${id}_${index}`,id,url,checkedAt,now);
      }
      await db.run("UPDATE rinkcircuit.import_rows SET status = 'approved',review_version=review_version+1 WHERE id = ?",row.id);
      await db.run(`INSERT INTO rinkcircuit.audit_logs (id,actor,action,entity_type,entity_id,details_json,created_at)
        VALUES (?,?,'import_create','league_programme',?,?,?)`,crypto.randomUUID(),actor,id,JSON.stringify({batchId,rowId:row.id}),now);
      createdCount++;
    }
    await db.run(`UPDATE rinkcircuit.import_batches SET approved_rows =
      (SELECT count(*) FROM rinkcircuit.import_rows WHERE batch_id = ? AND status = 'approved'),
      status = CASE WHEN EXISTS (SELECT 1 FROM rinkcircuit.import_rows WHERE batch_id=? AND status='pending_review') THEN 'partially_reviewed' ELSE 'committed' END WHERE id = ?`,batchId,batchId,batchId);
    return { batchId, createdCount, updatedCount, skippedCount, totalCommitted:createdCount+updatedCount };
  });
}
async function getBatchReview(batchId) {
  const db = getDb();
  const batch = await db.get('SELECT id,status FROM rinkcircuit.import_batches WHERE id=?',batchId);
  if (!batch) { const error=new Error('Import batch not found.');error.status=404;throw error; }
  const rows = await db.all('SELECT * FROM rinkcircuit.import_rows WHERE batch_id=? ORDER BY id',batchId);
  const programmes = await db.all('SELECT id,name,area,category,version,verification_status,last_checked_at FROM rinkcircuit.league_programmes');
  const resolutions=await db.all("SELECT a.entity_id,a.details_json,a.created_at FROM rinkcircuit.audit_logs a JOIN rinkcircuit.import_rows r ON r.id=a.entity_id WHERE r.batch_id=? AND a.action='import_resolve_hold' ORDER BY a.created_at DESC",batchId);
  const stagedRows = rows.map(row => {
    const raw=JSON.parse(row.raw_data_json), flags=JSON.parse(row.flags||'[]');
    const matches=programmes.filter(p=>p.id===raw._existingId || (normalize(p.name)===normalize(row.candidate_programme_name)&&normalize(p.area)===normalize(row.candidate_area)));
    const existing=matches.length===1?matches[0]:null;
    if(rows.some(other=>other.id!==row.id&&other.status==='pending_review'&&other.row_key===row.row_key)&&!flags.includes('ambiguous_match'))flags.push('ambiguous_match');
    if(matches.length && !flags.includes('duplicate_candidate'))flags.push('duplicate_candidate');
    if(matches.length>1 && !flags.includes('ambiguous_match'))flags.push('ambiguous_match');
    if(existing && raw._existingVersion && existing.version!==raw._existingVersion)flags.push('changed_since_staging');
    const sources=[...new Set(sourceUrls(row.evidence_url))];
    if(!sources.length&&!flags.includes('invalid_source'))flags.push('invalid_source');
    const rawChecked=row.evidence_url===String(raw.Source||raw.source||raw.url||'').trim() ? raw['Checked on']||raw.checked_at : null;
    const checkedAt=typeof rawChecked==='string'&&/^\d{4}-\d{2}-\d{2}/.test(rawChecked)&&!Number.isNaN(Date.parse(rawChecked))?new Date(rawChecked).toISOString():null;
    const blocked=flags.some(flag=>['missing_fields','invalid_source','ambiguous_match','operator_confirmed_conflict','editorial_hold'].includes(flag));
    const action=row.status!=='pending_review'?row.status:matches.length||raw._existingId?'preserve_existing':blocked?'needs_review':(flags.includes('applicant_lead')||flags.includes('publication_hold'))?'create_draft':'create_published';
    return {id:row.id,status:row.status,reviewVersion:row.review_version,candidateName:row.candidate_programme_name,candidateArea:row.candidate_area,candidateCategory:row.candidate_category,flags,
      sources,checkedAt,freshness:!checkedAt?'unknown':Date.parse(checkedAt)>Date.now()?'future_date':Date.parse(checkedAt)<Date.now()-90*86400000?'stale':'recent',
      editorialResolution:flags.includes('scope_reviewed') ? (()=>{const entry=resolutions.find(item=>item.entity_id===row.id);if(!entry)return null;const detail=JSON.parse(entry.details_json);return {scope:detail.programmeScope,evidenceUrl:detail.evidence?.url,reviewedAt:entry.created_at};})() : null,
      sourceReview:sourceReviewFor(row.candidate_programme_name,row.candidate_area,row.candidate_category,row.evidence_url),
      existingMatch:existing,plannedAction:action,selectable:['create_draft','create_published'].includes(action),
      fields:[['name',row.candidate_programme_name],['area',row.candidate_area],['category',row.candidate_category]].map(([field,incoming])=>({field,current:existing?.[field]??null,incoming,changed:!!existing&&existing[field]!==incoming})),
      conflictInfo:matches.length||raw._existingId?{message:'Existing records are preserved. Apply any approved changes through a separate editorial update.'}:null};
  });
  return {batchId,status:batch.status,totalRows:rows.length,stagedRows,summary:{total:rows.length,missingFields:stagedRows.filter(r=>r.flags.includes('missing_fields')).length,operatorConflicts:stagedRows.filter(r=>r.flags.includes('operator_confirmed_conflict')).length,applicantLeads:stagedRows.filter(r=>r.flags.includes('applicant_lead')).length,duplicateCandidates:stagedRows.filter(r=>r.flags.includes('duplicate_candidate')).length,pending:stagedRows.filter(r=>r.status==='pending_review').length,approved:stagedRows.filter(r=>r.status==='approved').length,skipped:stagedRows.filter(r=>r.status==='skipped').length}};
}
async function reviewImportRow(batchId,rowId,input,actor){
  const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
  if(!input||!['reject','correct','hold','classify_programme','resolve_hold'].includes(input.action)||!Number.isInteger(input.version))fail(400,'A review action and current row version are required.');
  if(typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>2000)fail(400,'Record a review reason between 5 and 2000 characters.');
  if(input.action==='correct')for(const key of ['name','area','category','source'])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>(key==='source'?2048:200))fail(400,'Provide valid name, area, category and source fields.');
  if(input.action==='correct'&&!sourceUrls(input.source).length)fail(400,'Supply a valid HTTP or HTTPS source without credentials.');
  if(['classify_programme','resolve_hold'].includes(input.action) && (input.evidenceReviewed!==true || typeof input.evidenceUrl!=='string' || sourceUrls(input.evidenceUrl).length!==1 || sourceUrls(input.evidenceUrl)[0]!==input.evidenceUrl || /ice-allocation-entitlements/i.test(input.evidenceUrl)))fail(400,'Confirm review of one official programme source, not an allocation document.');
  if(input.action==='resolve_hold' && (typeof input.programmeScope!=='string' || input.programmeScope.trim().length<20 || input.programmeScope.length>2000))fail(400,'Describe the resolved programme, season and venue scope (20 to 2000 characters).');
  const db=getDb();
  await db.transaction(async()=>{
    await db.get('SELECT pg_advisory_xact_lock(826412906)');
    await db.get('SELECT id FROM rinkcircuit.import_batches WHERE id=? FOR UPDATE',batchId);
    const row=await db.get('SELECT * FROM rinkcircuit.import_rows WHERE id=? AND batch_id=? FOR UPDATE',rowId,batchId);
    if(!row)fail(404,'Staged row not found.');
    if(row.status!=='pending_review'||row.review_version!==input.version)fail(409,'This row has already changed or been reviewed. Reload the batch.');
    const originalFlags=JSON.parse(row.flags||'[]');
    const before={flags:originalFlags,name:row.candidate_programme_name,area:row.candidate_area,category:row.candidate_category,source:sourceUrls(row.evidence_url).join(' ')};
    if(input.action==='reject')await db.run("UPDATE rinkcircuit.import_rows SET status='rejected',review_version=review_version+1 WHERE id=?",rowId);
    else if(['hold','classify_programme','resolve_hold'].includes(input.action)){
      let flags=[...originalFlags];
      if(input.action==='hold'){
        if(flags.includes('editorial_hold'))fail(409,'This candidate is already on editorial hold.');
        flags=flags.filter(flag=>flag!=='scope_reviewed');
        flags.push('editorial_hold');
      }else if(input.action==='resolve_hold'){
        if(!flags.includes('editorial_hold'))fail(409,'This candidate is not on editorial hold.');
        if(!sourceUrls(row.evidence_url).includes(input.evidenceUrl))fail(400,'The reviewed source must belong to this candidate. Correct the source first.');
        if(flags.some(flag=>['missing_fields','invalid_source','ambiguous_match','operator_confirmed_conflict','applicant_lead'].includes(flag)))fail(409,'Resolve candidate validation and applicant classification before releasing the hold.');
        flags=flags.filter(flag=>flag!=='editorial_hold');
        for(const flag of ['publication_hold','scope_reviewed'])if(!flags.includes(flag))flags.push(flag);
      }else{
        if(!flags.includes('applicant_lead'))fail(409,'This candidate is not an unresolved applicant.');
        if(!sourceUrls(row.evidence_url).includes(input.evidenceUrl))fail(400,'The reviewed source must belong to this candidate. Correct the source first.');
        flags=flags.filter(flag=>flag!=='applicant_lead');
        if(!flags.includes('publication_hold'))flags.push('publication_hold');
      }
      await db.run('UPDATE rinkcircuit.import_rows SET flags=?,review_version=review_version+1 WHERE id=?',JSON.stringify(flags),rowId);
    }
    else{
      const flags=JSON.parse(row.flags||'[]').filter(flag=>!['missing_fields','invalid_source','duplicate_candidate','ambiguous_match'].includes(flag));
      if(flags.includes('scope_reviewed')){flags.splice(flags.indexOf('scope_reviewed'),1);if(!flags.includes('editorial_hold'))flags.push('editorial_hold');}
      if(/h\.e\.t\.i\.|applicant|ice-allocation-entitlements|unresolved applicant/i.test([input.name,input.category,input.source].join(' '))&&!flags.includes('applicant_lead'))flags.push('applicant_lead');
      await db.run('UPDATE rinkcircuit.import_rows SET candidate_programme_name=?,candidate_area=?,candidate_category=?,evidence_url=?,row_key=?,flags=?,review_version=review_version+1 WHERE id=?',input.name.trim(),input.area.trim(),input.category.trim(),input.source.trim(),hash(`${normalize(input.name)}|${normalize(input.area)}`),JSON.stringify(flags),rowId);
    }
    const updatedRow=await db.get('SELECT flags FROM rinkcircuit.import_rows WHERE id=?',rowId);
    await db.run(`INSERT INTO rinkcircuit.audit_logs(id,actor,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,'import_row',?,?,?)`,crypto.randomUUID(),actor,'import_'+input.action,rowId,JSON.stringify({batchId,reason:input.reason.trim(),programmeScope:input.action==='resolve_hold'?input.programmeScope.trim():null,evidence:['classify_programme','resolve_hold'].includes(input.action)?{url:input.evidenceUrl,reviewed:true}:null,before,afterFlags:JSON.parse(updatedRow.flags),after:input.action==='correct'?{name:input.name,area:input.area,category:input.category,source:input.source}:null}),new Date().toISOString());
    await db.run("UPDATE rinkcircuit.import_batches SET status=CASE WHEN EXISTS(SELECT 1 FROM rinkcircuit.import_rows WHERE batch_id=? AND status='pending_review') THEN 'partially_reviewed' ELSE 'reviewed' END WHERE id=?",batchId,batchId);
  });
  return getBatchReview(batchId);
}
module.exports = { previewAndStageBatch, commitStagedBatch, getBatchReview, reviewImportRow };
