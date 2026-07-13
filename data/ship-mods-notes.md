# Ship Mods Reference (Crafted Hull/Component Augments)

Reference notes for `ship-mods.json` and `ship-mod-levels.json` — a system
distinct from ship purchases (`ship-purchases-notes.md`): these mods are
**crafted from raw/processed materials** (Metamaterials, Amorphites, Aerogels,
Superalloys, Nanotubes — a different material system from the mining/refining
production chain), come in **15 levels each** with scaling part cost and
scaling effect, and are applied via a `MOD EFFECT` command family rather than
`SF MODEL`/`SF INSTALL`. No Marks price appears anywhere — crafting cost is
entirely in parts.

The crafting mechanism itself (any additional Marks cost, which slot pool a
mod occupies) is not covered by this data — only the mod catalog and its
per-level parts/effects are. The install command *is* now confirmed (see
below).

## In-game commands these are sourced from
- `mod effect list shipmods` — the full catalog: shortname, type (always
  "Ship mod"), full name.
- `mod effect info <shortname>` — full detail for one mod: family,
  manufacturer, info text (the mechanical tradeoff), parts cost per level 1-15
  (stated for Interceptor hulls), and effect per level 1-15.
- `MOD INSTALL <shortname> INTO SHIP AT LEVEL <level>` — installs/fits a
  crafted mod at the given level. Confirmed live against the old fan tool
  (seurimas.github.io/starmourn-ship-builder), which emits this line per
  fitted mod in its command-output box; the shortnames it uses are unchanged
  from this data's, so the syntax transfers even though some mod full names
  have since changed.

## Data files
- **`ship-mods.json`** (50 rows) — one row per mod: shortname, full name,
  family, manufacturer, info text, effect and parts cost at Level 1 and Level
  15 (the two endpoints, for a quick sense of scale), the class cost-
  multiplier note, and a notes field for oddities (see below).
- **`ship-mod-levels.json`** (750 rows) — full-fidelity detail, one row per
  mod per level (50 x 15). **Effect scaling per level is not linear** (e.g.
  `shield_res_em` goes +2.10% at L1 → +3.90% at L2 → +6.00% at L3 → ... →
  +30.00% at L15, an accelerating-then-flattening curve) — don't interpolate
  between the Level 1/15 endpoints in `ship-mods.json`; use this file for any
  specific level.

## Facts
- **9 families**: Shield Modification (7 mods), Superstructure Modification
  (9), Engine Modification (4), Capacitor Modification (3), Shipsim
  Modification (3), Sensor Modification (4), Weapon Modification (12 — covers
  4 weapon types x roughly 3 sub-effects each: optimize/attenuate/damage-type),
  Mining Modification (5), Interdiction Modification (2), Electronic Warfare
  Modification (1).
- **Part costs scale by hull class, not just by level** — every mod's parts
  table is stated for Interceptor hulls; the same mod costs 25% more parts on
  a Corvette, 50% on a Destroyer, 75% on a Cruiser, 100% on a Battleship, 60%
  on a Freighter, 80% on a Superhauler, and 120% on a Carrier. Identical
  multiplier across all 50 mods.
- **Most mods carry an explicit tradeoff** (per their info text) — e.g.
  `shield_augment` raises max shield strength but raises halon draw;
  `shield_res_em` raises EM resistance but lowers gravitic/kinetic
  resistance. Only 2 of 50 have no listed penalty: `mass_reducer` (trims
  superstructure mass) and `skipfield_integrity` (raises base Skipfield
  Integrity).
- **The 9 `*_optimize` mods lock out other modifications to the same
  component/weapon type**: `engine_optimize`, `capacitor_optimize`,
  `shipsim_optimize`, `shield_optimize`, `sensor_optimize`, `laser_optimize`,
  `cannon_optimize`, `turret_optimize`, `missile_optimize` each reduce halon
  draw on their component, but explicitly block other mods on that same
  component/weapon type (e.g. `engine_optimize` blocks `engine_overclock`/
  `engine_bulwark` on the same ship). Distinct from the exclusivity below.
- **`expanded_hardpoints`, `expanded_modulebay`, and `cargohold_optimizer` are
  mutually exclusive with each other** and each requires all modules
  uninstalled to install or remove. These trade one ship-wide capacity stat
  for another (hardpoint capacity ↔ module capacity ↔ cargo space) at a
  1:1-or-worse ratio (capacity gained cannot exceed capacity lost).
- **`turn_time`'s full name is literally "Reduces turn time"** — a plain
  description rather than a branded product name like the other 49 mods
  (e.g. "Skipdrive Overclock", "Drag Compensators").
- **All 50 mods draw from the same 5 raw materials**: Metamaterials,
  Amorphites, Aerogels, Superalloys, Nanotubes. These are a separate material
  pool from the mining/refining/autofactory production chain used elsewhere
  in the game.
