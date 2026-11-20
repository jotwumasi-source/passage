// Fills site/data/enrichment.json with open-data facts about each university.
// Sources (all CC0): ROR (identity, website, founding year), Wikidata (student numbers),
// OpenAlex (research output). No API keys needed. Be polite: small request volume, delays.
//
// Usage: node scripts/enrich.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'site', 'data');
const universities = JSON.parse(fs.readFileSync(path.join(dataDir, 'universities.json'), 'utf8'));
const outFile = path.join(dataDir, 'enrichment.json');
const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

const UA = 'PassageDataBot/0.1 (open-source student guide; github.com)';
const ISO = { UK: 'GB', US: 'US', CA: 'CA', DE: 'DE', NL: 'NL', SE: 'SE', CH: 'CH', FR: 'FR', AU: 'AU', SG: 'SG', JP: 'JP', KR: 'KR', CN: 'CN' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(the|of)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function findRor(u) {
  // A pinned ROR id in universities.json ("ror": "https://ror.org/...") always wins.
  if (u.ror) return getJson(`https://api.ror.org/v2/organizations/${encodeURIComponent(u.ror.replace('https://ror.org/', ''))}`);
  const iso = ISO[u.c];
  if (!iso) return null; // for example Erasmus Mundus, which is not one institution
  const data = await getJson(`https://api.ror.org/v2/organizations?query=${encodeURIComponent(u.n)}`);
  const candidates = (data.items || []).filter(
    (it) => (it.locations || []).some((l) => l.geonames_details?.country_code === iso) && (it.types || []).includes('education')
  );
  const want = norm(u.n);
  // Prefer an exact (normalised) name match on any name, so "Purdue University" beats "Purdue University System".
  const exact = candidates.find((it) => (it.names || []).some((n) => norm(n.value) === want));
  if (exact) return exact;
  console.log(`  note ${u.id}: no exact name match, using best-ranked result (check it)`);
  return candidates[0] || null;
}

function latestStudents(entity, qid) {
  const claims = entity?.entities?.[qid]?.claims?.P2196;
  if (!claims || !claims.length) return null;
  // Only trust dated statements (point in time, P585). Undated counts are often wrong or stale.
  const rows = claims
    .map((c) => ({
      n: Number(c.mainsnak?.datavalue?.value?.amount),
      d: c.qualifiers?.P585?.[0]?.datavalue?.value?.time || '',
    }))
    .filter((r) => Number.isFinite(r.n) && r.n > 0 && r.d);
  if (!rows.length) return null;
  // Wikidata has noise (for example a one-off subset counted as total students). Drop values far from the median.
  const sorted = rows.map((r) => r.n).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const sane = rows.filter((r) => r.n >= median * 0.4 && r.n <= median * 2.5);
  if (!sane.length) return null;
  sane.sort((a, b) => a.d.localeCompare(b.d));
  return sane[sane.length - 1].n;
}

const result = {};
const today = new Date().toISOString().slice(0, 10);

for (const u of universities) {
  try {
    const ror = await findRor(u);
    if (!ror) { console.log(`- ${u.id}: no ROR match`); if (previous[u.id]) result[u.id] = previous[u.id]; continue; }
    const links = ror.links || [];
    const website = links.find((l) => l.type === 'website')?.value || null;
    const wikipedia = links.find((l) => l.type === 'wikipedia')?.value || null;
    const qid = (ror.external_ids || []).find((x) => x.type === 'wikidata')?.all?.[0] || null;
    const loc = ror.locations?.[0]?.geonames_details || {};
    const rec = {
      ror: ror.id,
      wikidata: qid,
      established: ror.established || null,
      website,
      wikipedia,
      city: loc.name || null,
      lat: loc.lat ?? null,
      lng: loc.lng ?? null,
      students: null,
      worksCount: null,
      citedBy: null,
      fetched: today,
    };
    if (qid) {
      try {
        const ent = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
        rec.students = latestStudents(ent, qid);
      } catch (e) { console.log(`  wikidata ${u.id}: ${e.message}`); }
      await sleep(250);
    }
    try {
      const oa = await getJson(`https://api.openalex.org/institutions?filter=ror:${encodeURIComponent(ror.id)}&select=id,display_name,works_count,cited_by_count`);
      const first = oa.results?.[0];
      if (first) { rec.worksCount = first.works_count ?? null; rec.citedBy = first.cited_by_count ?? null; rec.openalex = first.id; }
    } catch (e) { console.log(`  openalex ${u.id}: ${e.message}`); }
    result[u.id] = rec;
    console.log(`+ ${u.id}: ${ror.names?.find((n) => (n.types || []).includes('ror_display'))?.value || ''} | founded ${rec.established} | students ${rec.students} | works ${rec.worksCount}`);
  } catch (e) {
    console.log(`! ${u.id}: ${e.message}`);
    if (previous[u.id]) result[u.id] = previous[u.id];
  }
  await sleep(300);
}

fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote ${Object.keys(result).length} records to ${path.relative(root, outFile)}`);
