import { ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

/**
 * Baseline (no ship-mods applied yet — that's Phase 4) build stat calculations.
 *
 * Formulas here are not guessed: they're reverse-engineered by driving the old
 * site (https://seurimas.github.io/starmourn-ship-builder/) with a known build
 * (hull id 20 Akari Yards Corsair + capacitor 3 + engine 23 + shield 1 + shipsim 3
 * + sensor 1, with and without a Cannon I module) and matching its displayed
 * output against the input stats. See stats-engine.spec.ts for the calibration
 * build and the exact confirmed numbers. Notably:
 * - Health = hull.strength_dam + shield.shield_strength_dam only. The old site
 *   has no per-component "hp" concept at all, so the `hp` field our current data
 *   snapshot carries on capacitor/engine/sensor/shipsim components (absent from
 *   the old site's data) is NOT folded into ship Health here — it's newer/extra
 *   information (likely per-component durability for a different mechanic) with
 *   no confirmed role in the aggregate Health stat.
 * - DPS = weapon_damage / firing_speed_s, not factoring in reload_speed_s.
 * - Turn speed is the hull's base turn_time_s, unmodified (mods aren't applied
 *   in this baseline engine — see the Phase 4 task for turn_time and similar mods).
 */

export interface BuildInput {
  hull: ShipModel;
  capacitor?: ShipComponent;
  engine?: ShipComponent;
  shield?: ShipComponent;
  shipsim?: ShipComponent;
  sensor?: ShipComponent;
  /** Fitted modules, weapon and non-weapon alike. */
  modules: ShipModule[];
}

export interface WeaponContribution {
  module: ShipModule;
  alphaStrike: number;
  dps: number;
}

export interface BudgetStat {
  used: number;
  max: number;
  remaining: number;
}

export interface BuildStats {
  power: BudgetStat;
  cycles: BudgetStat;
  health: { hull: number; shield: number; total: number };
  alphaStrike: number;
  dps: number;
  /** Per-weapon contribution — old site only shows a ship-wide total, this is a v1 improvement. */
  weaponBreakdown: WeaponContribution[];
  mass: number;
  /** null when no engine is fitted (can't compute a thrust ratio). */
  thrustOverMass: number | null;
  turnSpeedSeconds: number;
  price: number;
}

function fittedComponents(build: BuildInput): ShipComponent[] {
  return [build.capacitor, build.engine, build.shield, build.shipsim, build.sensor].filter(
    (c): c is ShipComponent => c != null,
  );
}

export function calculateBuildStats(build: BuildInput): BuildStats {
  const components = fittedComponents(build);
  const weapons = build.modules.filter((m) => m.weapon_module === 'Yes');

  const powerUsed =
    components.reduce((sum, c) => sum + c.power_need_halons, 0) +
    build.modules.reduce((sum, m) => sum + m.power_use_halons, 0);
  const powerMax = build.hull.power_halons;

  const cyclesUsed = build.modules.reduce((sum, m) => sum + m.shipsim_cycles, 0);
  const cyclesMax = build.shipsim?.max_cycles ?? 0;

  const hullHealth = build.hull.strength_dam;
  const shieldHealth = build.shield?.shield_strength_dam ?? 0;

  const weaponBreakdown: WeaponContribution[] = weapons.map((module) => ({
    module,
    alphaStrike: module.weapon_damage ?? 0,
    dps: module.firing_speed_s ? (module.weapon_damage ?? 0) / module.firing_speed_s : 0,
  }));

  const mass =
    build.hull.mass_tons +
    components.reduce((sum, c) => sum + c.mass_tons, 0) +
    build.modules.reduce((sum, m) => sum + m.mass_tons, 0);

  const price =
    build.hull.price_marks +
    components.reduce((sum, c) => sum + c.price_marks, 0) +
    build.modules.reduce((sum, m) => sum + m.price_marks, 0);

  return {
    power: { used: powerUsed, max: powerMax, remaining: powerMax - powerUsed },
    cycles: { used: cyclesUsed, max: cyclesMax, remaining: cyclesMax - cyclesUsed },
    health: { hull: hullHealth, shield: shieldHealth, total: hullHealth + shieldHealth },
    alphaStrike: weaponBreakdown.reduce((sum, w) => sum + w.alphaStrike, 0),
    dps: weaponBreakdown.reduce((sum, w) => sum + w.dps, 0),
    weaponBreakdown,
    mass,
    thrustOverMass: build.engine ? (build.engine.thrust_halons ?? 0) / mass : null,
    turnSpeedSeconds: build.hull.turn_time_s,
    price,
  };
}
