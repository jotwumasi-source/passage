// Validates site/data/*.json: shape, allowed values, and cross-references.
// Usage: node scripts/validate.mjs   (exits with code 1 on any error)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'site', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const config = read('config.json');
const unis = read('universities.json');
const schol = read('scholarships.json');
const countries = read('countries.json');
const articles = read('articles.json');

const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const flag = { enum: ['ver', 'part', 'ex'] };
const ajv = new Ajv({ allErrors: true, strict: false });

const uniSchema = {
  type: 'object',
  required: ['id', 'n', 'city', 'c', 'f', 'sel', 'minC', 'ielts', 'tl', 'th', 'lm', 'dur', 'start', 'by', 'v', 'fund', 'tip'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9]{2,8}$' },
    n: { type: 'string', minLength: 3 },
    c: { type: 'string' },
    f: { type: 'array', items: { type: 'string' }, minItems: 1 },
    sel: { enum: [1, 2, 3] },
    minC: { enum: [0, 1, 2, 3] },
    ielts: { type: 'number', minimum: 5, maximum: 9 },
    tl: { type: 'number', minimum: 0 },
    th: { type: 'number', minimum: 0 },
    lm: { type: 'number', minimum: 300, maximum: 4000 },
    dur: { type: 'number', minimum: 6, maximum: 60 },
    by: date,
    v: flag,
    verifiedOn: date,
    url: { type: 'string', pattern: '^https?://' },
    ror: { type: 'string', pattern: '^https://ror\.org/[a-z0-9]+$' },
    fund: { type: 'array', items: { type: 'string' } },
  },
};
const schSchema = {
  type: 'object',
  required: ['id', 'n', 'c', 't', 'lv', 'cov', 'minExp', 'nat', 'v', 'el', 'dl', 'note', 'tip'],
  properties: {
    id: { type: 'string' },
    lv: { type: 'array', items: { enum: ['masters', 'phd'] }, minItems: 1 },
    cov: { enum: ['Full', 'Partial', 'Varies'] },
    minExp: { type: 'number', minimum: 0, maximum: 10 },
    nat: { enum: ['open', 'cw', 'af', 'aga', 'notUK', 'notUS'] },
    v: flag,
    verifiedOn: date,
    url: { type: 'string', pattern: '^https?://' },
    closed: { type: 'boolean' },
  },
};
const countrySchema = {
  type: 'object',
  required: ['h', 'b', 'len', 'tui', 'liv', 'intake', 'work', 'money', 'v', 'good', 'watch'],
  properties: { v: flag, good: { type: 'array' }, watch: { type: 'array' }, verifiedOn: date, url: { type: 'string', pattern: '^https?://' } },
};

const errors = [];
const err = (m) => errors.push(m);
const check = (schema, item, label) => {
  const validate = ajv.compile(schema);
  if (!validate(item)) validate.errors.forEach((e) => err(`${label}: ${e.instancePath || '/'} ${e.message}`));
};

const ids = new Set();
for (const u of unis) {
  check(uniSchema, u, `university ${u.id}`);
  if (ids.has(u.id)) err(`duplicate university id ${u.id}`);
  ids.add(u.id);
  if (!config.CC[u.c]) err(`university ${u.id}: unknown country code ${u.c}`);
  if (!countries[u.c]) err(`university ${u.id}: no country guide for ${u.c}`);
  for (const f of u.f) if (!config.FIELDS[f]) err(`university ${u.id}: unknown field ${f}`);
  if (u.th < u.tl) err(`university ${u.id}: tuition high < low`);
  if (u.v !== 'ex' && !u.src) err(`university ${u.id}: verified data needs a src`);
  if (u.v !== 'ex' && !u.url) err(`university ${u.id}: verified data needs a url`);
}
const schIds = new Set();
for (const s of schol) {
  check(schSchema, s, `scholarship ${s.id}`);
  if (schIds.has(s.id)) err(`duplicate scholarship id ${s.id}`);
  schIds.add(s.id);
  if (s.c !== 'Global' && !config.CC[s.c]) err(`scholarship ${s.id}: unknown country ${s.c}`);
  if (s.v === 'ver' && !s.url) err(`scholarship ${s.id}: verified data needs a url`);
}
for (const u of unis) for (const f of u.fund) if (!schIds.has(f)) err(`university ${u.id}: unknown scholarship ${f}`);
for (const k of Object.keys(config.CC)) if (!countries[k]) err(`country ${k} has no guide`);
for (const [k, c] of Object.entries(countries)) check(countrySchema, c, `country ${k}`);
const aIds = new Set();
for (const a of articles) {
  if (aIds.has(a.id)) err(`duplicate article id ${a.id}`);
  aIds.add(a.id);
  for (const n of a.next || []) {
    const ok = ['profile', 'find', 'scholarships', 'help', 'sop', 'countries', 'plan', 'home'].includes(n[1]);
    if (!ok) err(`article ${a.id}: unknown next route ${n[1]}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => '  ' + e).join('\n'));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
const ver = (arr) => arr.filter((x) => x.v === 'ver').length;
console.log(`OK: ${unis.length} universities (${ver(unis)} verified), ${schol.length} scholarships (${ver(schol)} verified), ${Object.keys(countries).length} countries, ${articles.length} guides.`);
