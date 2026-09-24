# cookbook

Turn TikToks, recipe sites and screenshots into recipes you can cook from.

A completely static React app. Paste a TikTok link or a recipe-site link, drop in
a screenshot, or paste any recipe text, and get a structured, editable recipe
with ingredients, numbered steps, temperatures, timers and servings scaling.

No backend. No database. No accounts. No AI parsing.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 170 tests: parser, importers, a real-caption corpus, and app render tests (vitest)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

Node 20+ is recommended.

---

## Deploying to GitHub Pages

The build is already configured for it:

- `vite.config.ts` sets `base: './'`, so every asset is referenced relatively and
  the same `dist/` works at `https://user.github.io/cookbook/`, at a custom
  domain root, or from a local file server.
- The app uses **`HashRouter`**. GitHub Pages serves static files only, so a deep
  link such as `/cookbook/recipes/abc` would 404 on refresh under a history
  router. Hash routes (`/cookbook/#/recipes/abc`) always resolve to `index.html`.

`.github/workflows/deploy.yml` builds, tests and publishes on every push to
`main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

There are no environment variables, API keys or secrets of any kind.

---

## Importing

One box on the Add screen takes a link or text; two buttons beside it take a
screenshot or open a text area. Every route ends in the same preview, where the
source text can be corrected and the recipe re-reads as you type.

| Source | How it works | Reliability |
| --- | --- | --- |
| **TikTok link** | TikTok's public oEmbed endpoint returns the video's full caption, creator and cover image. It sends `Access-Control-Allow-Origin: *`, so the browser can call it directly with no key. Share messages ("Check out this video! https://vm.tiktok.com/…") work as-is. | Exact when the creator wrote the recipe in the caption, which is common. |
| **Recipe-site link** | The page's schema.org `Recipe` JSON-LD — what Google requires for recipe rich results, so almost every site has it — then microdata, then the page's readable text. | Exact from structured data. But most sites block cross-origin reads (see below). |
| **Screenshot** | On-device OCR (Tesseract, WebAssembly). If a TikTok link is visible in the image, the full caption is fetched from it; otherwise TikTok's interface text is stripped and the recognised caption is parsed. | Approximate; the recognised text is shown for correction. |
| **Pasted text** | Captions, a whole TikTok page (description plus AI summary), a blog post, page source, or a Recipe JSON object. | Depends on the text. |
| **Backup** | Settings → Import backup reads a file from Settings → Export. | Exact. |

### What a static site can and cannot reach

- **TikTok captions: yes.** oEmbed is CORS-open. Verified against a live video:
  the full 2,070-character recipe caption comes back.
- **TikTok transcripts: no.** Nothing public returns the spoken audio's
  transcript. The caption is what the app reads.
- **Recipe sites: mostly no, directly.** In a spot check of six popular sites,
  one (BBC Good Food) allowed a browser to read its pages. For everything else
  there are two routes that keep the app backend-free:
  - **The "Save to cookbook" bookmark** (Settings). It runs *on* the recipe
    site, where it can read the page's own recipe data, then opens cookbook with
    that data in the URL fragment — which browsers never send to any server. On
    iPhone/iPad: copy the code in Settings, bookmark any page, and paste the code
    as the bookmark's address.
  - **An optional CORS relay** (Settings), as a URL template containing
    `{url}`. Off by default. Recipe URLs are sent to whatever relay you
    configure, so only use one you trust — for example a few-line Cloudflare
    Worker of your own.
- **OCR assets.** Tesseract's WebAssembly engine and English model (~10 MB) are
  fetched from the jsDelivr CDN the first time someone imports a screenshot,
  then cached. The library itself is a separate 15 kB chunk that loads only
  then. Images never leave the device.

### TikTok's AI summary

TikTok shows an AI-generated summary under many cooking videos. It cannot be
fetched, but it can be pasted, and its usefulness mirrors the caption: when the
creator wrote out the recipe, the summary restates it; when they kept it on
their website, the summary is marketing prose with no quantities or steps.

So the rule is: **parse the description; if it already yields a complete recipe,
ignore the summary as a duplicate.** Servings and tips are still back-filled from
the summary, because a description usually omits them. When neither half has a
recipe, the app says so and points at the creator's site instead of inventing
one.

---

## The parser

Deterministic and rule-based: no model, no network, the same input always gives
the same output. `src/services/parser/`:

| Module | Responsibility |
| --- | --- |
| `numberParser.ts` | `2`, `1.5`, `1,5`, `3/4`, `½`, `1½`, `1-1/2`, `two`, `a couple`, `one and a half`, `2 to 3`; and `formatQuantity`, which renders scaled amounts as `1 1/2`, never `1.4999`. |
| `units.ts` | Unit aliases → short forms (`tablespoons` → `tbsp`), including containers (`can`, `jar`, `bag`…), with display pluralisation. |
| `ingredientParser.ts` | One line → `{ quantity, unit, name, preparation }`. Handles package sizes (`1 (14.5 oz) can`, `one 14-ounce can`), dual measures (`600g / 1.2 lb`), nested asides, `boneless, skinless` adjective commas, recipe-card `▢` bullets and footnote asterisks; drops site noise like prices (`($0.20)`) and `(Note 2)`. Duplicates listed with the same unit are added up. |
| `directionParser.ts` | Sentence splitting, durations (`1 hour 30 minutes`, `1 1/2 hours`, `half an hour`), temperatures including scale-less oven settings (`preheat the oven to 350` → 350°F; below 250 is read as °C), `Step 3:` prefixes, and splitting `mix … and bake …` into two steps. |
| `sections.ts` | Finds headed blocks (`Ingredients (serves 2–4)`, `Step-by-step Instructions`, `Notes`). A heading must be the *whole* line, so `Step 1: Preheat the oven` is content, not a heading. |
| `reflow.ts` | Restores structure to flattened text — oEmbed captions arrive as one line. Finds headings mid-line, splits a run-on ingredient list at quantities and item boundaries, and splits a run-on instruction paragraph at the author's step labels, numbers, or instructions. |
| `recipeParser.ts` | Orchestration: cleans caption noise (hashtags, emoji, keycap step numbers, `℉`), reads headed blocks when present and prose otherwise, and emits `warnings` so the UI can be honest about a weak parse. |

**Conventions**

- A spoken "degrees" with no scale is °F above 100 and °C at or below.
- A time range (`3-4 minutes`) sets the timer at the lower bound, so a timer
  never runs past the point food is done.
- Ingredient groups (`For the sauce:`, `~Spicy mayo~`, recipe-card group
  headings) are kept on each ingredient, and method headings (`Reheat (from
  frozen)`, schema.org `HowToSection`) on each step. Duplicates are only added
  up within one group.
- Meal types (Breakfast, Lunch, Dinner, Sides, Snacks, Dessert, Drinks) are
  guessed from the title, hashtags and schema.org category, and are editable.

The tests pin cases from real captions and real recipe sites
(`captionCorpus.json` holds 29 real TikTok captions with their expected titles,
ingredient counts and step counts); the importers
were checked against live pages from Budget Bytes, BBC Good Food, RecipeTin Eats
and Taming Twins, and against a live TikTok video.

---

## Project structure

```
src/
  components/     AppShell, RecipeImporter, RecipeHero, RecipeMeta, SegmentedTabs,
                  IngredientList, DirectionList, IngredientMention, ServingSelector, TimerDock,
                  RecipeCard, RecipeEditor, SearchBar, EmptyState, Icon
  pages/          Home, Recipes, RecipeDetails, RecipeEdit, Settings, ImportLanding
  services/
    import/       one ImportResult from any source: detect, tiktokImport,
                  schemaRecipe + htmlRecipe (recipe sites), bookmarklet,
                  ocr + screenshotText + screenshotImport, backup, fetchPage
    tiktok/       TikTokProvider (oEmbed), caption (titles), pageTextParser
    parser/       numberParser, units, ingredientParser, directionParser,
                  sections, reflow, recipeParser, vocabulary
  state/          RecipeStore (recipes + settings), TimerStore (cross-page timers)
  storage/        recipeStorage (localStorage, fully guarded)
  lib/            recipe helpers, mealTypes (labels + classifier),
                  mentions (ingredients named in a step)
  data/           demo recipes
  types/          Recipe, Ingredient, Direction, ParsedRecipe, MealType
```

Routes: `/`, `/import` (bookmark landing), `/recipes`, `/recipes/:id`,
`/recipes/:id/edit`, `/settings`.

The UI only ever sees an `ImportResult`, and the parser only ever sees a string,
so adding a source means writing one importer. Adding a backend later means
replacing `storage/recipeStorage.ts`.

---

## Features

- **Library** — search by title, creator or ingredient; filter chips for
  favourites, under 30 minutes, and meal type (only types you have are shown);
  sort by newest, A–Z or quickest.
- **Editing** — every field, including meal types, with add / remove / reorder
  for ingredients and steps.
- **Groups and sections** — ingredients are listed under the groups the
  caption or site gives them, and steps under their sections; both editable.
- **Ingredients in steps** — an ingredient named in a step ("the chicken",
  "the oil") shows its line from the ingredients list, scaled. It opens on hover
  with a mouse, on tap on a phone, and from the keyboard; Escape closes it.
- **Servings scaling** — rescales from the base servings as clean fractions.
- **Timers** — one tap from any step with a duration; they survive navigation
  and reloads, and count from wall-clock time so a throttled tab stays accurate.
- **Data** — export, import a backup, restore the demo recipes.

### Accessibility and layout

Semantic landmarks, a skip link, real checkboxes behind styled ones, an ARIA
tablist with arrow keys, `aria-pressed` on toggles, labelled fields, 44px touch
targets, visible focus, and no state shown by colour alone. Phones get a single
column and a bottom nav; from 1024px the recipe viewer sits beside its photo.

---

## Licence

Private project, unlicensed. The name `cookbook` is a placeholder.
