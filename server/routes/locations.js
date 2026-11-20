const express = require('express');
const router = express.Router();
const {
  getDb
} = require('../db/database');
const CITY_METADATA=Object.fromEntries([
 ['toronto','Toronto','City of Toronto'],['vaughan','Vaughan','York Region'],['brampton','Brampton','Peel Region'],
 ['mississauga','Mississauga','Peel Region'],['markham','Markham','York Region'],['richmond-hill','Richmond Hill','York Region'],
 ['whitby','Whitby','Durham Region'],['oakville','Oakville','Halton Region'],['burlington','Burlington','Halton Region']
].map(([key,name,region])=>[key,{name,province:'ON',region,headline:`Adult Hockey Leagues in ${name}`,
 description:`Browse published programme records for ${name}. Check each programme's official source for current details.`,arenas:[]}]));

/**
 * GET /api/locations
 * Returns list of curated cities
 */
router.get('/', async (req, res) => {
  const db = getDb();
  const counts=await db.all("SELECT lower(municipality) AS city,count(*) AS count FROM rinkcircuit.league_programmes WHERE publication_status='published' GROUP BY lower(municipality)");
  const cities=Object.entries(CITY_METADATA).map(([key,meta])=>({key,name:meta.name,province:meta.province,region:meta.region,leagueCount:counts.find(row=>row.city===meta.name.toLowerCase())?.count||0})).filter(city=>city.leagueCount>0);
  res.json({
    data: cities
  });
});

/**
 * GET /api/locations/:province/:city
 * Curated city guide
 */
router.get('/:province/:city', async (req, res) => {
  const db = getDb();
  const {
    province,
    city
  } = req.params;
  const cityKey = city.toLowerCase().replace(/[^a-z0-9\-]/g, '');
  const meta = CITY_METADATA[cityKey];
  if (!meta || province.toLowerCase()!=='on') {
    return res.status(404).json({
      error: 'City guide not yet published for this location'
    });
  }

  // Fetch published leagues in this municipality
  const leagues = await db.all(`
    SELECT
      p.id, p.name, p.slug, p.area, p.municipality, p.category, p.sport_type,
      p.description, p.verification_status, p.last_checked_at
    FROM rinkcircuit.league_programmes p
    WHERE lower(p.municipality) = ? AND p.publication_status = 'published'
    ORDER BY p.is_sponsored DESC, p.priority_score DESC, p.name ASC
  `, meta.name.toLowerCase());
  if(!leagues.length)return res.status(404).json({error:'No published city guide is available yet.'});
  const arenas=await db.all(`SELECT DISTINCT a.name FROM rinkcircuit.arenas a JOIN rinkcircuit.offering_arenas oa ON oa.arena_id=a.id JOIN rinkcircuit.season_offerings so ON so.id=oa.offering_id JOIN rinkcircuit.league_programmes p ON p.id=so.programme_id WHERE p.publication_status='published' AND lower(p.municipality)=? ORDER BY a.name`,meta.name.toLowerCase());
  const offeringsByProgramme=await require('../services/publicOfferings').forProgrammes(leagues.map(league=>league.id));
  const enrichedLeagues=leagues.map(league=>({...league,offerings:offeringsByProgramme.get(league.id)||[]}));
  res.json({
    data: {
      meta:{...meta,arenas:arenas.map(row=>row.name)},
      leagues:enrichedLeagues,
      totalLeagues: leagues.length
    }
  });
});
module.exports = router;
module.exports.cityMetadata=CITY_METADATA;
