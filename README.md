# Starmourn Ship Builder

A free, fan-made ship-building tool for [Starmourn](https://starmourn.com/), a sci-fi
text MUD. Pick a hull, fit components and modules, install crafted mods, and see
calculated stats update live — all client-side, no server, no account.

**Live app:** https://ellume.github.io/starmourn-ship-builder/

It's a modern rebuild of an
[earlier community tool](https://seurimas.github.io/starmourn-ship-builder/) by
Seurimas, reworked with a current Angular/PrimeNG stack and a freshly re-captured
game-data snapshot.

## Features

- **Ship picker** — browse hulls by class, see base stats before fitting anything.
- **Loadout editor** — fit the five component types (Capacitor, Engine, Sensor,
  Shield, Shipsim) and weapon/non-weapon hardpoint modules, respecting per-class
  fit availability.
- **Mods panel** — install crafted ship mods against a 6-slot / 60-level budget,
  with validation for mutually-exclusive capacity-trade mods and `*_optimize`
  lockouts.
- **Stats panel & Ship Summary drawer** — live-calculated stats (health, DPS,
  power/cycles, speed, resistances, and more), with the summary drawer giving a
  full `SF DETAILS`-style breakdown including per-item power draw and hardpoint
  counts.
- **In-game command output** — generates the exact `SF INSTALL`/`MOD INSTALL`
  commands needed to reproduce a build in-game, copyable by section.
- **Share links** — encodes the current build into a compact URL query string so
  builds can be shared without a backend.

## Tech stack

- **[Angular 21](https://angular.dev/)** — standalone components throughout (no
  `NgModule`s), the new esbuild-based `@angular/build:application` builder,
  signals for state.
- **[PrimeNG 21](https://primeng.org/)** (Aura theme) — UI components, dark theme
  by default.
- **TypeScript 5.9**, **RxJS 7** (mainly for `HttpClient`), **SCSS**.
- **[Vitest](https://vitest.dev/)** — unit tests, run through Angular's
  `@angular/build:unit-test` builder with a `jsdom` environment.
- **Prettier** for formatting (100-col width, single quotes).
- No backend: the app is a static bundle, and builds are just `structuredClone`-able
  JS objects encoded into the URL for sharing.

## Project structure

```
starmourn-ship-builder/
├── data/                     # canonical game-data snapshot (source of truth)
│   ├── ship-models.json      # hulls
│   ├── components.json       # capacitors/engines/sensors/shields/shipsims
│   ├── modules.json          # hardpoint + mod-cap modules
│   ├── ship-mods.json        # crafted mods (level 1 & 15 endpoints)
│   ├── ship-mod-levels.json  # same mods, full per-level detail
│   └── *-notes.md            # field-level details, caveats, known gaps
└── web/                       # the Angular app
    ├── public/data/           # gitignored copy of data/, synced at build time
    ├── scripts/sync-data.mjs  # copies data/*.json -> public/data/
    └── src/app/
        ├── core/
        │   ├── calc/          # stats-engine, mod-capacity, mod-effects
        │   ├── data/          # DataService (loads & exposes the JSON data)
        │   ├── models/        # TS models + the ship-mod effect-text parser
        │   └── state/         # build state, share-link encode/decode
        └── features/
            ├── ship-picker/
            ├── loadout-editor/
            ├── mods-panel/
            ├── stats-panel/
            └── ship-summary/
```

### Data layer

`data/` is the single source of truth: plain JSON, `snake_case` keys, captured
from in-game commands (`sf models`, `sf components all`, `mod effect list
shipmods`, etc. — see [`data/README.md`](data/README.md) and the accompanying
notes files for exactly how each file was captured and its known caveats). It's
a static snapshot, not a live feed, so it goes stale if the game's item catalog
changes.

`web/public/data/` is a **gitignored copy** of `data/`, synced by
[`web/scripts/sync-data.mjs`](web/scripts/sync-data.mjs) (`npm run sync-data`).
That script runs automatically before `npm start`/`npm run build` via npm's
`prestart`/`prebuild` hooks, and as an explicit step in CI — this keeps the game
data in one place while letting Angular serve it as static assets.

### Calculation engine

[`core/calc/stats-engine.ts`](web/src/app/core/calc/stats-engine.ts) computes
baseline build stats (health, DPS, power/cycles budgets, speed, mass, resistances,
and more). Since the game doesn't expose its internal formulas, they were
empirically reverse-engineered by calibrating against a known build's live output
from the original tool — see that file's header comment and
`stats-engine.spec.ts` for the pinned calibration numbers.

[`core/models/mod-effect-parser.ts`](web/src/app/core/models/mod-effect-parser.ts)
turns the free-text effect/cost descriptions in the crafted-mods data into
structured effects, flagging (rather than silently mis-parsing) any row that
doesn't match a known pattern.

[`core/calc/mod-capacity.ts`](web/src/app/core/calc/mod-capacity.ts) implements
the crafted-mods slot/level-budget system and its mutual-exclusion rules, which
is a separate system from hardpoint/module fitting.

## Development

Requires Node.js. All commands run from `web/`:

```bash
npm install
npm start          # dev server at localhost:4200
npm run build       # production build to web/dist/web/browser
npm test            # Vitest unit tests
npm run sync-data    # manually re-sync data/*.json into public/data/
```

`sync-data` runs automatically before `start`/`build` when invoked via `npm run`
(not when calling `ng serve`/`ng build` directly, since npm lifecycle hooks only
fire for `npm run` invocations).

## Deployment

Pushes to `main` trigger [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which installs dependencies, syncs the game data, builds with
`ng build --base-href /starmourn-ship-builder/`, and publishes to GitHub Pages.
