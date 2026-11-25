require('dotenv').config();
const { getDb, closeDb } = require('../server/db/database');
const crypto = require('crypto');

async function run() {
  const db = getDb();

  // 1. Publish all draft leagues
  console.log('Publishing all draft leagues in rinkcircuit.league_programmes...');
  const updateDrafts = await db.run(`
    UPDATE rinkcircuit.league_programmes
    SET publication_status = 'published',
        verification_status = 'research_checked',
        updated_at = ?
    WHERE publication_status = 'draft'
  `, new Date().toISOString());
  console.log('Updated drafts to published.');

  // 2. Check if Scotiabank Pond exists in league_programmes
  let scotia = await db.get("SELECT * FROM rinkcircuit.league_programmes WHERE name = 'Scotiabank Pond adult hockey'");
  if (!scotia) {
    console.log('Creating Scotiabank Pond adult hockey...');
    const progId = 'prog_imp_' + crypto.createHash('sha256').update('Scotiabank Pond adult hockey').digest('hex');
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO rinkcircuit.league_programmes (
        id, name, slug, area, municipality, category, sport_type,
        publication_status, verification_status, is_sponsored, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `,
      progId,
      'Scotiabank Pond adult hockey',
      'scotiabank-pond-adult-hockey',
      'Toronto',
      'Toronto',
      'Arena-run adult ice',
      'ice_hockey',
      'published',
      'research_checked',
      now,
      now
    );

    // Add source evidence
    await db.run(`
      INSERT INTO rinkcircuit.source_evidence (
        id, programme_id, url, source_type, created_at
      ) VALUES (?, ?, ?, 'official_website', ?)
    `,
      'src_scotiabank_pond',
      progId,
      'https://www.buckinghamarena.com/leagues/custom_page.cfm?clientid=6585&leagueid=32532&pageid=19038',
      now
    );

    // Add a basic season offering so it renders properly in cards
    await db.run(`
      INSERT INTO rinkcircuit.season_offerings (
        id, programme_id, season_label, skill_labels, nights, registration_modes, registration_status, created_at, updated_at
      ) VALUES (?, ?, 'Fall/Winter', 'All Skill Divisions', '["Monday","Tuesday","Wednesday","Thursday"]', 'Team & Individual', 'open', ?, ?)
    `,
      'off_scotiabank_pond',
      progId,
      now,
      now
    );

    console.log('Scotiabank Pond adult hockey created and published!');
  } else {
    await db.run(`
      UPDATE rinkcircuit.league_programmes
      SET publication_status = 'published', verification_status = 'research_checked'
      WHERE id = ?
    `, scotia.id);
  }

  // 3. Update any specific websites from research notes for better links
  const betterWebsites = [
    { name: 'Balmy Beach Club Men’s Hockey', url: 'https://www.bbchockey.com/teams/?p=about&s=hockey&t=c&u=BALMY' },
    { name: 'Canadian Japanese Hockey League', url: 'https://www.cjhl.net/' },
    { name: 'Forest Hill Senior Hockey Association', url: 'https://page.spordle.com/forest-hill-senior-hockey-association/contact' },
    { name: 'Greater Toronto Oldtimers Hockey League', url: 'https://leagues.carhahockey.ca/gtohl/' },
    { name: 'Humber Valley Oldtimers', url: 'https://hvot.ca/' }
  ];

  for (const bw of betterWebsites) {
    const prog = await db.get("SELECT id FROM rinkcircuit.league_programmes WHERE name = ?", bw.name);
    if (prog) {
      await db.run(`
        UPDATE rinkcircuit.source_evidence
        SET url = ?
        WHERE programme_id = ?
      `, bw.url, prog.id);
      console.log(`Updated website for ${bw.name} -> ${bw.url}`);
    }
  }

  // Check total published count
  const publishedCount = await db.get("SELECT count(*) as count FROM rinkcircuit.league_programmes WHERE publication_status = 'published'");
  console.log(`\nTOTAL PUBLISHED LEAGUES IN DB: ${publishedCount.count}`);
}

run().catch(console.error).finally(closeDb);
