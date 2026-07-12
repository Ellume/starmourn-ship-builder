# Ship data (JSON)

Plain JSON data for Starmourn ship loadouts — everything a ship-builder tool
needs: superstructures, fitted components, modules, and crafted mods, pulled
directly from in-game commands. Self-contained: everything referenced below
lives in this `data/` folder.

Static data snapshot, not a live feed — if the game's item catalog changes,
this needs a fresh in-game capture and re-export.

Each `.json` file is a flat array of objects, one per item,
keys in `snake_case`. Blank cells are `null` rather than omitted, so every row
in a file has the same key set.

| File | Rows | What it is |
|---|---|---|
| `ship-models.json` | 37 | Superstructures (hulls) buyable at any station shipyard. |
| `class-mod-slots.json` | 9 | Small/med/large mod-slot counts per hull class. |
| `components.json` | 153 | Fitted components — all 5 types (Capacitor/Engine/Sensor/Shield/Shipsim) in one file, filter on `type`. |
| `modules.json` | 51 | Hardpoint/mod-cap modules bought at a shipyard — weapon + non-weapon in one file, filter on `weapon_module`. |
| `ship-mods.json` | 50 | Crafted hull/component mods (the "Mods" system, distinct from the above) — level-1/level-15 endpoints only. |
| `ship-mod-levels.json` | 750 | Same 50 mods, full 15-level detail (non-linear scaling — don't interpolate the endpoints in `ship-mods.json`). |

See [ship-purchases-notes.md](ship-purchases-notes.md) and
[ship-mods-notes.md](ship-mods-notes.md) for the facts/caveats behind this data
— notably: every station's shipyard carries the same catalog, resistance
values of 0.00% are the bare pre-mod baseline, and ship mods' install/craft
mechanism (command, Marks cost if any, which slot pool) was never captured —
see `ship-mods-notes.md`'s "What this is" section.
