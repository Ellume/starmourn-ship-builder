# Ship Purchases Reference (Superstructures, Components, Modules)

Reference notes for `ship-models.json`, `components.json`, and `modules.json` —
everything a station shipyard sells.
Every station's shipyard carries the identical catalog, so there is no
per-station variation to account for: an ID/item is available everywhere.

## In-game commands these are sourced from
- `sf models` — a station's superstructure models for sale (ID, short desc,
  class, mass, hardpoints, mod cap, price).
- `sf model info <id>` — full stat block for one superstructure (make/model,
  size, mass, strength/turn time, class, capacity, power, refit cap,
  hardpoints, mod cap, resistances).
- `sf components all` — a station's fitted-component catalog, all 5 types at
  once (Capacitor/Engine/Sensor/Shield/Shipsim); each type has its own
  independent ID numbering (Capacitor #1 and Engine #1 are unrelated items).
- `sf inspect <type> <id>` — full stat block for one component. Columns vary
  by type: capacitors (Capacity in kear + HP), engines (Thrust + HP), sensors
  (Strength + HP + Jam Str), shields (Strength/dam + Recharge + 4
  resistance/antipierce stats, no HP), shipsims (Max Cycles + HP).
- `sf modules` — a station's module catalog: small/medium/large items that
  fill a hull's hardpoint (weapon modules) or mod-cap (everything else) slots.
- Buying a superstructure (`sf model <id>`) creates a bare hull; `sf install
  <type> <id>` fits a component into a hardpoint/mod-cap slot. The module
  install command wasn't captured (presumably a similar `sf install` form).

## Data files
- **`ship-models.json`** (37 rows) — one row per superstructure.
- **`components.json`** (153 rows) — all 5 component types in one array with a
  `type` field; type-specific stat fields are `null` where they don't apply.
- **`modules.json`** (51 rows) — weapon + non-weapon modules in one array,
  distinguished by `weapon_module`/`weapon_type` fields; weapon-only fields
  (firing speed, damage, cap drain, reload, optimal range, fall-off, use-no-
  ammo) are `null` for non-weapon rows, which instead carry their effect in
  `effect_bonus` (and `cooldown_s` for the few that are triggered rather than
  passive).

## Superstructures
- **ID numbering has gaps** (e.g. missing 23, 26, 27, 30, 31, 34, 36-38, 43-44,
  46-53) despite a universal catalog — read as variants not currently in
  stock/rotation or reserved/removed IDs, not a data error. The same gap
  pattern appears in every component type's ID sequence.
- **Resistance fields (Therm/Kin/Grav on hulls; Grav/Kin/EM/Antipierce on most
  shields) are 0% for most entries** — this is the bare item's base value
  before any mods are fitted, not a universal property. A minority of shields
  carry nonzero trade-off resistances (e.g. Ixodon Aegis 137: +10% Grav / -10%
  Kin; Ixodon Aegis S: +10% Grav / +10% Kin / -10% EM) — check `components.json`
  filtered to `type: "Shield"` rather than assuming all-zero.
- **Two premium/luxury lines cost far more than same-class peers with
  comparable stats**: Vertix Luxury Systems (superstructures Aether/Rain,
  capacitor Fuzz-9k) and Serenity Forgeworks (superstructures Redshift/Comet,
  capacitor Drehft v. 1.0). E.g. the Serenity Forgeworks Redshift (Destroyer)
  is 3.05M Marks vs. ~140k Marks for a same-class peer with similar
  hardpoints/mod cap; the Drehft v. 1.0 capacitor is ~60k Marks vs. 8-15k for
  same-class/capacity peers. Cause unconfirmed (branding vs. an undocumented
  stat) — flagged per-row in each file's `notes` field where present.
- **VR Battlespace (the "build any ship" simulator) excludes those same 4
  premium superstructures** — its `sf models` output lists the other 33 of the
  37 known superstructures exactly, consistent with the premium/luxury lines
  being a special tier outside normal shipyard stock rather than merely
  expensive.
- **Carrier class has 0 hardpoints and an unusually high Mod Cap.** — Carriers
  read as a mod-only/support hull, consistent with 0 weapon hardpoints;
  components exist for every component type for Carriers, so they're fully
  fittable.

## Modules
- **51 modules total, 26 weapon / 25 non-weapon** — classified purely by
  whether the item has a `weapon_type` (`cannon`, `turret`, `missile`,
  `laserbeam`, `mine`, `web`, `interdictor`, `signaljammer`, `antimine`,
  `tractor`, `capdrainer`, `cargoscanner`, `slicekit`), not by name: **Cargo
  Scanner is a weapon module** (fires/reloads/has optimal range like a gun),
  while **Material Scanner is not** (passive/triggered, cooldown only).
- **Some weapon modules deal 0 damage** (Cap Drainer, Cargo Scanner,
  Interdiction Web Launcher, Signal Jammers, Slicekit) — still weapon-slotted
  (fire/reload/range/fall-off, drains capacitor per shot) but their effect is
  utility (drain capacitor, scan cargo, apply a web/jam/virus) rather than
  direct damage. Don't treat `weapon_damage: 0` as non-combat.
- **`cargoscanner`/`capdrainer`/`slicekit` carry a "use no ammo" percentage**
  — a per-activation chance to not consume whatever ammo/charge resource the
  module uses; underlying mechanism undocumented.
- **ICE Firmware modules' description text undersells their real effect by
  10x, across all 6 variants** — e.g. ICE Firmware - Capacitor's description
  reads "+10% ICE to the capacitor" but its effect field reads "+100.00%
  Capacitor ICE"; ICE Firmware - Multisystem's description says "+5% ICE to
  all components" but the effect field lists +50.00% per system. Treat the
  effect-field numbers as authoritative.
- **`mass_tons` is 0 for every module** (unlike superstructures/components,
  which have real masses) — either modules genuinely add no hull mass, or the
  in-game listing doesn't expose it; unconfirmed which.
- **A few non-weapon modules are triggered/on-cooldown rather than passive**:
  Emergency Cap Charger (60s), Emergency Skipboosters (20s), Material Scanner
  (20s) — these carry a `cooldown_s` value; every other non-weapon module is
  an always-on passive bonus.
- **Emergency Cap Charger's effect field reads "+0.01% an emergency cap
  charger"** — the leading "+0.01%" looks like a formatting artifact rather
  than a real stat (no other non-weapon module's effect text has a stray
  leading percentage before description-style text).
- **Per-class module availability is now confirmed** (2026-07-12, via each
  class's live `sf modules` catalog in-game) and captured in each module's
  `classes` field: **Interceptor** can only fit small-size modules (its
  catalog is exactly the all-small subset); **Carrier** can only fit
  non-weapon modules (exactly the all-non-weapon subset, consistent with its
  0 hardpoints); **Freighter** can fit everything except large-size weapon
  modules (it keeps large non-weapon utility items like Augmented Engine III
  and Cargo Hold III); **Battleship, Corvette, Cruiser, Destroyer, and
  Superhauler** can all fit the entire 51-module catalog. This supersedes an
  earlier note here (removed 2026-07-12) that called per-class restriction
  unconfirmed — that in-game recheck is what settled it.
