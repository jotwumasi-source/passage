# Passage

A graduate-school guide for international students. Compare programmes across 14 destinations and 14 fields, see how your profile fits (Safe, Target, Reach, Long shot), find scholarships matched to your citizenship, age and experience, plan applications, and buy expert help with tokens.

It is a static site: no server, no build step. Open data lives in JSON files.

> **Status: prototype.** Only facts marked **Verified** were read from official pages. Everything marked **Example** is indicative and must be checked before real students rely on it.

## Run it

```bash
npm install          # only needed for the data scripts
npm run serve        # http://localhost:8123  (python http.server over ./site)
npm run validate     # checks data/*.json
npm run enrich       # refreshes open-data facts (Wikidata, ROR, OpenAlex)
```

The app fetches `site/data/*.json`, so it must be served over http. Opening `index.html` as a file will not work.

## Layout

```
site/
  index.html           the whole app (HTML, CSS, JS)
  data/
    config.json        fields, currencies, nationalities, services, documents, timeline
    universities.json  programmes (one record per university)
    scholarships.json  funding routes with eligibility rules
    countries.json     destination guides, post-study work and visa rules
    articles.json      advice guides
    enrichment.json    generated: open-data facts per university (do not edit by hand)
  vendor/fuse.min.js   Fuse.js 7.0.0 (Apache-2.0), fuzzy search
scripts/
  validate.mjs         schema and cross-reference checks (Ajv)
  enrich.mjs           pulls Wikidata, ROR and OpenAlex facts
.github/workflows/     Pages deploy, weekly data checks, monthly open-data refresh
```

## Data policy

Every record carries a verification flag, `v`:

| Flag | Meaning |
|---|---|
| `ver` | Read from an official page. Must have `src`, `url` and `verifiedOn`. |
| `part` | Some facts were read from an official page, the rest are examples. |
| `ex` | Example value. Not verified. |

Where facts come from, in order of trust:

1. **Official pages** (university, funder, government). This is the only source for tuition, deadlines, requirements and eligibility. Many university sites block bots or render with JavaScript, so most of this is still manual.
2. **Open datasets, CC0**: [ROR](https://ror.org) (identity, website, founding year), [Wikidata](https://www.wikidata.org) (student numbers), [OpenAlex](https://openalex.org) (research output). Used for the "About the university" panel. Matches are checked by name and country, and wrong ones can be pinned with a `ror` id in `universities.json`.
3. **Commercial portals** (Mastersportal, FindAMasters, ranking sites). **Do not scrape these.** Their terms normally forbid it, and the data is their product. Use a partnership, an API or an affiliate feed if you want their listings.

Universities rarely publish acceptance rates, so the app shows *competition* (Moderate, High, Very high) instead of inventing numbers.

Spot-check enrichment values. Wikidata contains noise, and some totals cover a whole university system (for example the Illinois student count looks high).

## Add or fix a programme

1. Edit `site/data/universities.json`. Copy an existing record.
2. If you read a fact from an official page, set `"v": "ver"` (or `"part"`), and add `src`, `url` and `verifiedOn`.
3. Run `npm run validate`.
4. Open a pull request. The checks workflow validates the data and checks that every `url` still resolves.

## Deploy to GitHub Pages

1. Push to a repository on GitHub.
2. Settings > Pages > Source: **GitHub Actions**.
3. Push to `main`. `.github/workflows/pages.yml` validates the data and publishes `site/`.

GitHub Pages on a free account needs a **public** repository.

## Open-source pieces

| Project | Licence | Used for |
|---|---|---|
| [Fuse.js](https://github.com/krisk/Fuse) | Apache-2.0 | Fuzzy search in the programme list (vendored) |
| [Ajv](https://github.com/ajv-validator/ajv) | MIT | Data validation in CI |
| [lychee](https://github.com/lycheeverse/lychee) | Apache-2.0 / MIT | Weekly check that source links still work |
| [create-pull-request](https://github.com/peter-evans/create-pull-request) | MIT | Monthly open-data refresh as a reviewable PR |
| ROR, Wikidata, OpenAlex | CC0 data | University background facts |

Good next candidates, if needed: [Playwright](https://github.com/microsoft/playwright) or [Crawlee](https://github.com/apify/crawlee) (both Apache-2.0) to read JavaScript-rendered official pages, with robots.txt and terms respected; [Decap CMS](https://github.com/decaporg/decap-cms) (MIT) so non-developers can edit the JSON files; the [Hipo university domains list](https://github.com/Hipo/university-domains-list) (MIT) to cross-check official domains. Check each project's licence before adding it.

## Not built yet

- Real accounts, payments and tokens. The wallet, expert requests and SOP review are simulated in the browser.
- Real expert marketplace (vetting, scheduling, payouts, child-safety and privacy rules).
- A verified data set. Most programme fees and deadlines are still examples.
- A licence. Choose one before inviting contributors.
