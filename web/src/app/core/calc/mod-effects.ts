import { hardpointPointsUsed, modCapPointsUsed } from './capacity';
import { ShipModule, cargoCapacityBonusTons } from '../models/module';
import { ModEffect } from '../models/ship-mod';
import { BASE_MAX_SPEED, BuildInput, BuildStats, calculateBuildStats } from './stats-engine';

/**
 * Applies crafted-mod effects (data/ship-mod-levels.json, parsed by mod-effect-parser)
 * on top of the baseline stats-engine numbers. Mods are ship-wide, not per-component,
 * but their canonical stat names (see mod-effect-parser's canonicalizeStats) each
 * target one specific hull/component/module attribute — STAT_TARGETS below is that
 * mapping, built from a full scan of all 750 rows (66 distinct canonical stats).
 *
 * Not every canonical stat has somewhere to go: some name a mechanic this app
 * doesn't model at all (mining/interdiction/etc.), and some name a component-HP
 * concept stats-engine deliberately excludes from Health. Those are listed in
 * OTHER_EFFECT_REASONS instead of STAT_TARGETS so they still surface in the UI (as
 * an "other effects" list) rather than silently vanishing — see computeModdedStats's
 * `other` output.
 */

type MassTarget = 'hull' | 'capacitor' | 'engine' | 'sensor' | 'shipsim';
type HalonTarget = 'capacitor' | 'engine' | 'sensor' | 'shipsim' | 'shield';
/** The 4 weapon families that have dedicated damage/halon/kear-cost mods — mine/web/interdictor/etc. don't. */
type WeaponFamily = 'cannon' | 'turret' | 'missile' | 'laserbeam';
type ResistanceTarget = 'hullThermal' | 'hullKinetic' | 'hullGravitic' | 'shieldEM' | 'shieldKinetic' | 'shieldGravitic';
/** Ammo-based, not weapon-based — see the damageTypeBonus case in computeModdedStats. */
type DamageType = 'EM' | 'Kinetic' | 'Thermal' | 'Gravitic';

type StatTarget =
  | { kind: 'mass'; target: MassTarget }
  | { kind: 'thrust' }
  | { kind: 'turnSpeed' }
  | { kind: 'maxSpeed' }
  | { kind: 'hullHp' }
  | { kind: 'shieldHp' }
  | { kind: 'halonCost'; target: HalonTarget }
  | { kind: 'cyclesMax' }
  | { kind: 'weaponDamage'; family: WeaponFamily }
  | { kind: 'weaponHalonCost'; family: WeaponFamily }
  | { kind: 'weaponKearCost'; family: WeaponFamily }
  | { kind: 'resistance'; target: ResistanceTarget }
  | { kind: 'jamStrength' }
  | { kind: 'rechargeTime' }
  | { kind: 'capacitance' }
  | { kind: 'cargoCapacity' }
  | { kind: 'hardpointCapacity' }
  | { kind: 'moduleCapacity' }
  /** "hardpoint capacity replaced as module capacity" — converts hardpoint budget into module budget. */
  | { kind: 'hardpointToModuleCapacity' }
  /** "module capacity replaced as hardpoint capacity" — converts module budget into hardpoint budget. */
  | { kind: 'moduleToHardpointCapacity' }
  | { kind: 'damageTypeBonus'; damageType: DamageType };

export const STAT_TARGETS: Record<string, StatTarget> = {
  'superstructure mass': { kind: 'mass', target: 'hull' },
  'capacitor mass': { kind: 'mass', target: 'capacitor' },
  'engine mass': { kind: 'mass', target: 'engine' },
  'sensor mass': { kind: 'mass', target: 'sensor' },
  'shipsim mass': { kind: 'mass', target: 'shipsim' },

  'engine thrust output': { kind: 'thrust' },
  'turn time': { kind: 'turnSpeed' },
  'maximum speed': { kind: 'maxSpeed' },

  'hull hit points': { kind: 'hullHp' },
  'shield hit points': { kind: 'shieldHp' },
  'shield strength': { kind: 'shieldHp' },

  'capacitor halon cost': { kind: 'halonCost', target: 'capacitor' },
  'engine halon cost': { kind: 'halonCost', target: 'engine' },
  'sensor halon cost': { kind: 'halonCost', target: 'sensor' },
  'shipsim halon cost': { kind: 'halonCost', target: 'shipsim' },
  'shield halon cost': { kind: 'halonCost', target: 'shield' },

  'cycles generated': { kind: 'cyclesMax' },
  'shipsim cycle output': { kind: 'cyclesMax' },

  'cannon damage': { kind: 'weaponDamage', family: 'cannon' },
  'turret damage': { kind: 'weaponDamage', family: 'turret' },
  'missile damage': { kind: 'weaponDamage', family: 'missile' },
  'laser damage': { kind: 'weaponDamage', family: 'laserbeam' },

  'cannon halon cost': { kind: 'weaponHalonCost', family: 'cannon' },
  'turret halon cost': { kind: 'weaponHalonCost', family: 'turret' },
  'missile halon cost': { kind: 'weaponHalonCost', family: 'missile' },
  'laser halon cost': { kind: 'weaponHalonCost', family: 'laserbeam' },

  'cannon kear cost': { kind: 'weaponKearCost', family: 'cannon' },
  'turret kear cost': { kind: 'weaponKearCost', family: 'turret' },
  'missile kear cost': { kind: 'weaponKearCost', family: 'missile' },
  'laser kear cost': { kind: 'weaponKearCost', family: 'laserbeam' },

  'hull thermal resistance': { kind: 'resistance', target: 'hullThermal' },
  'hull kinetic resistance': { kind: 'resistance', target: 'hullKinetic' },
  'hull gravitic resistance': { kind: 'resistance', target: 'hullGravitic' },
  'shield EM resistance': { kind: 'resistance', target: 'shieldEM' },
  'shield kinetic resistance': { kind: 'resistance', target: 'shieldKinetic' },
  'shield gravitic resistance': { kind: 'resistance', target: 'shieldGravitic' },

  'sensor jam strength': { kind: 'jamStrength' },
  'shield recharge time': { kind: 'rechargeTime' },
  capacitance: { kind: 'capacitance' },
  'cargohold capacity': { kind: 'cargoCapacity' },

  'hardpoint capacity': { kind: 'hardpointCapacity' },
  'module capacity': { kind: 'moduleCapacity' },
  'hardpoint capacity replaced as module capacity': { kind: 'hardpointToModuleCapacity' },
  'module capacity replaced as hardpoint capacity': { kind: 'moduleToHardpointCapacity' },

  // Damage type is chosen by loaded ammo, not fixed per weapon module, so these can't be
  // attributed to specific fitted weapons — surfaced as a flat aggregated bonus instead
  // of a base/final breakdown. See computeModdedStats's `damageTypeBonuses` output.
  'EM damage': { kind: 'damageTypeBonus', damageType: 'EM' },
  'kinetic damage': { kind: 'damageTypeBonus', damageType: 'Kinetic' },
  'thermal damage': { kind: 'damageTypeBonus', damageType: 'Thermal' },
  'gravitic damage': { kind: 'damageTypeBonus', damageType: 'Gravitic' },
};

/** Canonical stats deliberately left out of STAT_TARGETS, and why. Kept in sync with the
 * full 66-stat scan by the completeness test in mod-effects.spec.ts. */
export const OTHER_EFFECT_REASONS: Record<string, string> = {
  'capacitor hit points': "component HP is deliberately excluded from Health (see stats-engine's header comment)",
  'engine hit points': 'component HP is deliberately excluded from Health',
  'sensor hit points': 'component HP is deliberately excluded from Health',
  'shipsim hit points': 'component HP is deliberately excluded from Health',

  'chance that attack bypasses shields': 'no modeled mechanic for this in BuildStats',
  'compressor additional yield chance': 'mining mechanic not modeled in BuildStats',
  'compressor cycle cost': 'mining mechanic not modeled in BuildStats',
  'crusher additional yield chance': 'mining mechanic not modeled in BuildStats',
  'crusher cycle cost': 'mining mechanic not modeled in BuildStats',
  'harvestdrone tick time': 'mining mechanic not modeled in BuildStats',
  'ICE firmware cycle cost': 'utility-module mechanic not modeled in BuildStats',
  'ICE to all components': 'utility-module mechanic not modeled in BuildStats',
  'interdiction beam cycle cost': 'utility-module mechanic not modeled in BuildStats',
  'interdiction beam power': 'utility-module mechanic not modeled in BuildStats',
  'scoop capacity': 'utility-module mechanic not modeled in BuildStats',
  'scoop drag penalty': 'utility-module mechanic not modeled in BuildStats',
  'ship beacon range': 'utility-module mechanic not modeled in BuildStats',
  'Skipfield Integrity': 'unique single-mod stat with no known base value anywhere in the data',
};

/** One fitted mod's parsed effects at its current level, ready to aggregate. */
export interface ModEffectSource {
  modName: string;
  level: number;
  effects: ModEffect[];
}

/**
 * One mod's contribution to a stat — a mod appears once here even if it affects
 * several fitted items of the same kind (e.g. 2 fitted cannons). `level` is null
 * for non-leveled sources (e.g. a linked Damage Boost module), which have no
 * ship-mod level to show. `count` is set only when this single entry already
 * combines several fitted instances of the same-named source (e.g. 2 fitted
 * Cargo Hold Is merged into one line, since dedup keys on modName+level) — display
 * as an "Nx " prefix so the combination isn't mistaken for one bigger bonus.
 */
export interface ModContribution {
  modName: string;
  level: number | null;
  deltaPct: number;
  count?: number;
}

export interface StatBreakdown {
  base: number;
  contributions: ModContribution[];
  final: number;
}

export interface OtherEffect {
  modName: string;
  level: number;
  stat: string;
  deltaPct: number;
  reason: string;
}

/** No base value to apply a % to (damage is ammo-typed, not weapon-typed) — just the raw aggregated bonus. */
export interface DamageTypeBonus {
  damageType: DamageType;
  totalPct: number;
  contributions: ModContribution[];
}

export interface WeaponModBreakdown {
  module: ShipModule;
  alphaStrike: StatBreakdown;
  dps: StatBreakdown;
  capDrainKear: StatBreakdown;
}

/** Hardpoint/module capacity are a soft (warn-only) budget, like Power/Cycles — see loadout-editor.ts. */
export interface CapacityStat {
  used: number;
  max: StatBreakdown;
  remaining: number;
}

export interface ModdedBuildStats {
  /** Unmodified stats-engine output, for reference/sanity-checking against `base` fields below. */
  baseline: BuildStats;
  mass: StatBreakdown;
  thrustOverMass: StatBreakdown | null;
  turnSpeedSeconds: StatBreakdown;
  maxSpeed: StatBreakdown;
  /** null when no engine is fitted (same guard as thrustOverMass). */
  timeToMaxSpeedSeconds: StatBreakdown | null;
  health: { hull: StatBreakdown; shield: StatBreakdown; total: number };
  power: { used: StatBreakdown; max: number; remaining: number };
  cycles: { max: StatBreakdown; used: number; remaining: number };
  alphaStrike: StatBreakdown;
  dps: StatBreakdown;
  /** Per-weapon contribution, modded — old site only shows a ship-wide total. */
  weaponBreakdown: WeaponModBreakdown[];
  totalCapDrainKear: StatBreakdown;
  cargoCapacityTons: StatBreakdown;
  resistances: Record<ResistanceTarget, StatBreakdown>;
  sensorJamStrength: StatBreakdown;
  shieldRechargeSeconds: StatBreakdown;
  capacitance: StatBreakdown;
  hardpoints: CapacityStat;
  modCap: CapacityStat;
  /** Only entries a fitted mod actually touches — empty array when none do. */
  damageTypeBonuses: DamageTypeBonus[];
  /** Effects that don't map to any tracked stat — surfaced so nothing silently vanishes. */
  other: OtherEffect[];
}

function dedupeContributions(contribs: ModContribution[]): ModContribution[] {
  const byKey = new Map<string, ModContribution>();
  for (const c of contribs) byKey.set(`${c.modName}#${c.level}`, c);
  return [...byKey.values()];
}

function applyDeltas(base: number, contribs: ModContribution[]): StatBreakdown {
  const contributions = dedupeContributions(contribs);
  const totalPct = contributions.reduce((sum, c) => sum + c.deltaPct, 0);
  return { base, contributions, final: base * (1 + totalPct / 100) };
}

/**
 * Resistances are already expressed as a percentage (every hull's therm/kin/grav
 * resistance is 0 in the source data; shields range -15..+15) — a mod's "+X%
 * resistance" adds X percentage points directly rather than scaling a physical
 * quantity, unlike mass/hp/halon-cost mods. Multiplying would leave a 0-base hull
 * resistance at 0 forever, which is exactly what these mods are meant to fix.
 */
function applyAdditiveDeltas(base: number, contribs: ModContribution[]): StatBreakdown {
  const contributions = dedupeContributions(contribs);
  const totalPct = contributions.reduce((sum, c) => sum + c.deltaPct, 0);
  return { base, contributions, final: base + totalPct };
}

function sumBreakdowns(parts: StatBreakdown[]): StatBreakdown {
  return {
    base: parts.reduce((sum, p) => sum + p.base, 0),
    contributions: dedupeContributions(parts.flatMap((p) => p.contributions)),
    final: parts.reduce((sum, p) => sum + p.final, 0),
  };
}

/**
 * Like sumBreakdowns, but for summing several *differently-based* parts (one
 * per fitted weapon) where a contribution's raw deltaPct is only meaningful
 * relative to its own part's base — e.g. a linked Damage Boost's +10% applies
 * to one weapon's damage, not to the ship-wide total. Recomputes each named
 * contribution's aggregate deltaPct from its actual dollar amount (part.base *
 * deltaPct/100) as a share of the summed base, so a boost on one weapon out of
 * several shows its true (smaller) overall %. For a contribution applied
 * uniformly across every part (the common case — a ship mod that boosts a
 * whole weapon family equally), this reduces to the same raw deltaPct, so it's
 * a strict improvement over sumBreakdowns rather than a behavior change for
 * the uniform case.
 */
function sumWeightedBreakdowns(parts: StatBreakdown[]): StatBreakdown {
  const base = parts.reduce((sum, p) => sum + p.base, 0);
  const final = parts.reduce((sum, p) => sum + p.final, 0);
  const byKey = new Map<string, { modName: string; level: number | null; dollars: number; count: number }>();
  for (const p of parts) {
    for (const c of p.contributions) {
      const key = `${c.modName}#${c.level}`;
      const dollars = (p.base * c.deltaPct) / 100;
      const existing = byKey.get(key);
      if (existing) {
        existing.dollars += dollars;
        existing.count += 1;
      } else {
        byKey.set(key, { modName: c.modName, level: c.level, dollars, count: 1 });
      }
    }
  }
  const contributions: ModContribution[] = [...byKey.values()].map((e) => {
    // Round off float noise from the dollars/base round-trip (e.g. a single
    // uniformly-applied contribution should come back as exactly its original
    // deltaPct, not 9.899999999999999) — percentages here only ever originate
    // from 2-decimal source data anyway.
    const deltaPct = base ? Math.round((e.dollars / base) * 1e8) / 1e6 : 0;
    return { modName: e.modName, level: e.level, deltaPct, ...(e.count > 1 ? { count: e.count } : {}) };
  });
  return { base, contributions, final };
}

export function computeModdedStats(
  build: BuildInput,
  modSources: ModEffectSource[],
  damageBoostCounts?: Map<number, number>,
): ModdedBuildStats {
  const baseline = calculateBuildStats(build);
  const other: OtherEffect[] = [];

  const massContribs: Record<MassTarget, ModContribution[]> = { hull: [], capacitor: [], engine: [], sensor: [], shipsim: [] };
  const thrustContribs: ModContribution[] = [];
  const turnContribs: ModContribution[] = [];
  const maxSpeedContribs: ModContribution[] = [];
  const hullHpContribs: ModContribution[] = [];
  const shieldHpContribs: ModContribution[] = [];
  const halonContribs: Record<HalonTarget, ModContribution[]> = {
    capacitor: [],
    engine: [],
    sensor: [],
    shipsim: [],
    shield: [],
  };
  const cyclesContribs: ModContribution[] = [];
  const weaponDamageContribs: Record<WeaponFamily, ModContribution[]> = {
    cannon: [],
    turret: [],
    missile: [],
    laserbeam: [],
  };
  const weaponHalonContribs: Record<WeaponFamily, ModContribution[]> = {
    cannon: [],
    turret: [],
    missile: [],
    laserbeam: [],
  };
  const weaponKearContribs: Record<WeaponFamily, ModContribution[]> = {
    cannon: [],
    turret: [],
    missile: [],
    laserbeam: [],
  };
  const resistanceContribs: Record<ResistanceTarget, ModContribution[]> = {
    hullThermal: [],
    hullKinetic: [],
    hullGravitic: [],
    shieldEM: [],
    shieldKinetic: [],
    shieldGravitic: [],
  };
  const jamContribs: ModContribution[] = [];
  const rechargeContribs: ModContribution[] = [];
  const capacitanceContribs: ModContribution[] = [];
  const cargoContribs: ModContribution[] = [];
  const hardpointCapacityContribs: ModContribution[] = [];
  const moduleCapacityContribs: ModContribution[] = [];
  const hpToMcContribs: ModContribution[] = [];
  const mcToHpContribs: ModContribution[] = [];
  const damageTypeContribs: Record<DamageType, ModContribution[]> = {
    EM: [],
    Kinetic: [],
    Thermal: [],
    Gravitic: [],
  };

  for (const source of modSources) {
    for (const effect of source.effects) {
      // Not typed as ModContribution here — source.level (a ship mod's level) is always a number, and OtherEffect below requires that, unlike ModContribution which also allows null for non-leveled sources.
      const contribution = { modName: source.modName, level: source.level, deltaPct: effect.delta_pct };
      const target = STAT_TARGETS[effect.stat];
      if (!target) {
        other.push({
          ...contribution,
          stat: effect.stat,
          reason: OTHER_EFFECT_REASONS[effect.stat] ?? 'not yet mapped to a BuildStats field',
        });
        continue;
      }
      switch (target.kind) {
        case 'mass':
          massContribs[target.target].push(contribution);
          break;
        case 'thrust':
          thrustContribs.push(contribution);
          break;
        case 'turnSpeed':
          turnContribs.push(contribution);
          break;
        case 'maxSpeed':
          maxSpeedContribs.push(contribution);
          break;
        case 'hullHp':
          hullHpContribs.push(contribution);
          break;
        case 'shieldHp':
          shieldHpContribs.push(contribution);
          break;
        case 'halonCost':
          halonContribs[target.target].push(contribution);
          break;
        case 'cyclesMax':
          cyclesContribs.push(contribution);
          break;
        case 'weaponDamage':
          weaponDamageContribs[target.family].push(contribution);
          break;
        case 'weaponHalonCost':
          weaponHalonContribs[target.family].push(contribution);
          break;
        case 'weaponKearCost':
          weaponKearContribs[target.family].push(contribution);
          break;
        case 'resistance':
          resistanceContribs[target.target].push(contribution);
          break;
        case 'jamStrength':
          jamContribs.push(contribution);
          break;
        case 'rechargeTime':
          rechargeContribs.push(contribution);
          break;
        case 'capacitance':
          capacitanceContribs.push(contribution);
          break;
        case 'cargoCapacity':
          cargoContribs.push(contribution);
          break;
        case 'hardpointCapacity':
          hardpointCapacityContribs.push(contribution);
          break;
        case 'moduleCapacity':
          moduleCapacityContribs.push(contribution);
          break;
        case 'hardpointToModuleCapacity':
          hpToMcContribs.push(contribution);
          break;
        case 'moduleToHardpointCapacity':
          mcToHpContribs.push(contribution);
          break;
        case 'damageTypeBonus':
          damageTypeContribs[target.damageType].push(contribution);
          break;
      }
    }
  }

  // --- Mass (per hull/component, then summed) ---
  // No mod stat in the data targets shield mass, but the shield's mass_tons still
  // counts toward the ship's total (see stats-engine's fittedComponents) — included
  // here as a base-only, contribution-free term so the totals still match baseline.
  const mass = sumBreakdowns([
    applyDeltas(build.hull.mass_tons, massContribs.hull),
    applyDeltas(build.capacitor?.mass_tons ?? 0, massContribs.capacitor),
    applyDeltas(build.engine?.mass_tons ?? 0, massContribs.engine),
    applyDeltas(build.sensor?.mass_tons ?? 0, massContribs.sensor),
    applyDeltas(build.shipsim?.mass_tons ?? 0, massContribs.shipsim),
    applyDeltas(build.shield?.mass_tons ?? 0, []),
  ]);
  // Modules always carry 0 mass_tons in the source data (see stats-engine.spec.ts) — added
  // for symmetry with calculateBuildStats in case that ever changes, not because it does anything today.
  const moduleMass = build.modules.reduce((sum, m) => sum + m.mass_tons, 0);
  mass.base += moduleMass;
  mass.final += moduleMass;

  // --- Thrust / Mass ---
  const thrustOverMass = build.engine
    ? (() => {
        const thrust = applyDeltas(build.engine!.thrust_halons ?? 0, thrustContribs);
        return {
          base: thrust.base / mass.base,
          contributions: dedupeContributions([...thrust.contributions, ...mass.contributions]),
          final: thrust.final / mass.final,
        };
      })()
    : null;

  const turnSpeedSeconds = applyDeltas(build.hull.turn_time_s, turnContribs);

  // --- Max speed / time to max speed ---
  // Max speed is a flat constant across every hull (confirmed by the user) — see
  // stats-engine's BASE_MAX_SPEED. Time to max speed derives from thrust/mass, the
  // acceleration proxy that determines how fast a ship climbs to that shared cap.
  const maxSpeed = applyDeltas(BASE_MAX_SPEED, maxSpeedContribs);
  const timeToMaxSpeedSeconds = thrustOverMass
    ? {
        base: maxSpeed.base / thrustOverMass.base,
        contributions: dedupeContributions([...maxSpeed.contributions, ...thrustOverMass.contributions]),
        final: maxSpeed.final / thrustOverMass.final,
      }
    : null;

  // --- Health ---
  const hullHp = applyDeltas(build.hull.strength_dam, hullHpContribs);
  const shieldHp = applyDeltas(build.shield?.shield_strength_dam ?? 0, shieldHpContribs);
  const health = { hull: hullHp, shield: shieldHp, total: hullHp.final + shieldHp.final };

  // --- Power ---
  const componentHalon = sumBreakdowns([
    applyDeltas(build.capacitor?.power_need_halons ?? 0, halonContribs.capacitor),
    applyDeltas(build.engine?.power_need_halons ?? 0, halonContribs.engine),
    applyDeltas(build.sensor?.power_need_halons ?? 0, halonContribs.sensor),
    applyDeltas(build.shipsim?.power_need_halons ?? 0, halonContribs.shipsim),
    applyDeltas(build.shield?.power_need_halons ?? 0, halonContribs.shield),
  ]);
  const moduleHalon = sumBreakdowns(
    build.modules.map((m) => {
      const family = m.weapon_type as WeaponFamily | null;
      const contribs = family ? (weaponHalonContribs[family] ?? []) : [];
      return applyDeltas(m.power_use_halons, contribs);
    }),
  );
  const powerUsed = sumBreakdowns([componentHalon, moduleHalon]);
  // No mod stat in the data raises/lowers a hull's power_halons max — only draw is ever modded.
  const power = { used: powerUsed, max: baseline.power.max, remaining: baseline.power.max - powerUsed.final };

  // --- Cycles ---
  const cyclesMaxBreakdown = applyDeltas(build.shipsim?.max_cycles ?? 0, cyclesContribs);
  // No mod stat lowers a module's own cycle cost, only a shipsim's generation — used stays baseline.
  const cycles = {
    max: cyclesMaxBreakdown,
    used: baseline.cycles.used,
    remaining: cyclesMaxBreakdown.final - baseline.cycles.used,
  };

  // --- Weapons: damage, plus kear cost per fitted weapon ---
  // Each fitted Damage Boost module links to one physical weapon, but fitted weapon
  // instances of the same type are indistinguishable in this data model (see
  // BuildStore.damageBoostLinks) — so `damageBoostCounts` (linked-boost count per
  // weapon *type*) is consumed one credit per instance as we walk the fitted
  // weapons, instead of applying the full count to every instance of that type.
  const boostCreditsRemaining = new Map(damageBoostCounts ?? []);
  const weaponDamageBreakdowns = build.modules
    .filter((m) => m.weapon_module === 'Yes')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => {
      const family = m.weapon_type as WeaponFamily | null;
      const creditsLeft = boostCreditsRemaining.get(m.id) ?? 0;
      const boosted = creditsLeft > 0;
      if (boosted) boostCreditsRemaining.set(m.id, creditsLeft - 1);
      const dmgContribs = [...(family ? (weaponDamageContribs[family] ?? []) : [])];
      const kearContribs = [...(family ? (weaponKearContribs[family] ?? []) : [])];
      if (boosted) {
        // No level — this is a linked module effect, not a leveled ship mod.
        dmgContribs.push({ modName: 'Damage Boost (linked)', level: null, deltaPct: 10 });
        kearContribs.push({ modName: 'Damage Boost (linked)', level: null, deltaPct: 30 });
      }
      const dmg = applyDeltas(m.weapon_damage ?? 0, dmgContribs);
      const dps: StatBreakdown = m.firing_speed_s
        ? { base: dmg.base / m.firing_speed_s, contributions: dmg.contributions, final: dmg.final / m.firing_speed_s }
        : { base: 0, contributions: dmg.contributions, final: 0 };
      const kear = applyDeltas(m.cap_drain_kear ?? 0, kearContribs);
      return { module: m, alphaStrike: dmg, dps, kear };
    });
  const alphaStrike = sumWeightedBreakdowns(weaponDamageBreakdowns.map((w) => w.alphaStrike));
  const dps = sumWeightedBreakdowns(weaponDamageBreakdowns.map((w) => w.dps));
  const totalCapDrainKear = sumWeightedBreakdowns(weaponDamageBreakdowns.map((w) => w.kear));

  // --- Cargo ---
  // Cargo Hold I/II/III grant a flat tons bonus, unlike ship mods' percentage
  // bonuses — expressed here as the equivalent % of the hull's base capacity so
  // both sources compose through the same single applyDeltas pass (matches how
  // every other modded stat sums its deltas once against an unmodified base,
  // rather than compounding sequentially). Tons are summed per module name first
  // (rather than pushed one contribution per fitted instance) since dedupeContributions
  // keys on modName+level and would otherwise silently drop all but one instance
  // of the same fitted module — level is null here so every same-named module
  // would collide on the same key.
  if (build.hull.capacity_tons > 0) {
    const cargoByModuleName = new Map<string, { tons: number; count: number }>();
    for (const m of build.modules) {
      const tons = cargoCapacityBonusTons(m);
      if (tons > 0) {
        const existing = cargoByModuleName.get(m.name) ?? { tons: 0, count: 0 };
        cargoByModuleName.set(m.name, { tons: existing.tons + tons, count: existing.count + 1 });
      }
    }
    for (const [modName, { tons, count }] of cargoByModuleName) {
      cargoContribs.push({ modName, level: null, count, deltaPct: (tons / build.hull.capacity_tons) * 100 });
    }
  }
  const cargoCapacityTons = applyDeltas(build.hull.capacity_tons, cargoContribs);

  // --- Resistances (additive) ---
  const resistances: Record<ResistanceTarget, StatBreakdown> = {
    hullThermal: applyAdditiveDeltas(build.hull.therm_res, resistanceContribs.hullThermal),
    hullKinetic: applyAdditiveDeltas(build.hull.kin_res, resistanceContribs.hullKinetic),
    hullGravitic: applyAdditiveDeltas(build.hull.grav_res, resistanceContribs.hullGravitic),
    shieldEM: applyAdditiveDeltas(build.shield?.em_res ?? 0, resistanceContribs.shieldEM),
    shieldKinetic: applyAdditiveDeltas(build.shield?.kin_res ?? 0, resistanceContribs.shieldKinetic),
    shieldGravitic: applyAdditiveDeltas(build.shield?.grav_res ?? 0, resistanceContribs.shieldGravitic),
  };

  // --- Sensor jam strength / shield recharge / capacitance ---
  const sensorJamStrength = applyDeltas(build.sensor?.jam_str ?? 0, jamContribs);
  const shieldRechargeSeconds = applyDeltas(build.shield?.recharge_s ?? 0, rechargeContribs);
  const capacitance = applyDeltas(build.capacitor?.capacity_kear ?? 0, capacitanceContribs);

  // --- Hardpoint / module capacity ---
  // "hardpoint capacity" / "module capacity" are plain percentage boosts of their own
  // budget (e.g. cargohold_optimizer's tradeoff cut). "X replaced as Y" mods (expanded_
  // hardpoints/expanded_modulebay) instead convert a % of one hull budget into the
  // other — modeled here as a % of each budget's own *base* value (not of the other's
  // already-modded value) to keep the math order-independent; not confirmed against
  // live play since crafted mods predate any old-site calibration data (see
  // ship-mods-notes.md), so treat this conversion formula as a best-effort inference.
  const baseHardpoints = build.hull.hardpoints;
  const baseModCap = build.hull.mod_cap;
  const hardpointPct = dedupeContributions(hardpointCapacityContribs).reduce((sum, c) => sum + c.deltaPct, 0);
  const modulePct = dedupeContributions(moduleCapacityContribs).reduce((sum, c) => sum + c.deltaPct, 0);
  const toModulePct = dedupeContributions(hpToMcContribs).reduce((sum, c) => sum + c.deltaPct, 0);
  const toHardpointPct = dedupeContributions(mcToHpContribs).reduce((sum, c) => sum + c.deltaPct, 0);

  const hardpointsConvertedOut = baseHardpoints * (toModulePct / 100);
  const hardpointsConvertedIn = baseModCap * (toHardpointPct / 100);
  const moduleConvertedOut = baseModCap * (toHardpointPct / 100);
  const moduleConvertedIn = baseHardpoints * (toModulePct / 100);

  const hardpointsMax: StatBreakdown = {
    base: baseHardpoints,
    contributions: dedupeContributions([
      ...hardpointCapacityContribs,
      ...hpToMcContribs.map((c) => ({ ...c, deltaPct: -c.deltaPct })),
      ...mcToHpContribs,
    ]),
    final: baseHardpoints * (1 + hardpointPct / 100) - hardpointsConvertedOut + hardpointsConvertedIn,
  };
  const moduleMax: StatBreakdown = {
    base: baseModCap,
    contributions: dedupeContributions([
      ...moduleCapacityContribs,
      ...mcToHpContribs.map((c) => ({ ...c, deltaPct: -c.deltaPct })),
      ...hpToMcContribs,
    ]),
    final: baseModCap * (1 + modulePct / 100) - moduleConvertedOut + moduleConvertedIn,
  };
  const hardpointsUsed = hardpointPointsUsed(build.modules);
  const moduleUsed = modCapPointsUsed(build.modules);
  const hardpoints: CapacityStat = { used: hardpointsUsed, max: hardpointsMax, remaining: hardpointsMax.final - hardpointsUsed };
  const modCap: CapacityStat = { used: moduleUsed, max: moduleMax, remaining: moduleMax.final - moduleUsed };

  // --- Weapon damage-type bonuses — flat aggregated %, no base/final (see StatTarget's damageTypeBonus case) ---
  const damageTypeBonuses: DamageTypeBonus[] = (['EM', 'Kinetic', 'Thermal', 'Gravitic'] as DamageType[])
    .map((damageType) => {
      const contributions = dedupeContributions(damageTypeContribs[damageType]);
      return { damageType, contributions, totalPct: contributions.reduce((sum, c) => sum + c.deltaPct, 0) };
    })
    .filter((d) => d.contributions.length > 0);

  return {
    baseline,
    mass,
    thrustOverMass,
    turnSpeedSeconds,
    maxSpeed,
    timeToMaxSpeedSeconds,
    health,
    power,
    cycles,
    alphaStrike,
    dps,
    weaponBreakdown: weaponDamageBreakdowns.map((w) => ({
      module: w.module,
      alphaStrike: w.alphaStrike,
      dps: w.dps,
      capDrainKear: w.kear,
    })),
    totalCapDrainKear,
    cargoCapacityTons,
    resistances,
    sensorJamStrength,
    shieldRechargeSeconds,
    capacitance,
    hardpoints,
    modCap,
    damageTypeBonuses,
    other,
  };
}
