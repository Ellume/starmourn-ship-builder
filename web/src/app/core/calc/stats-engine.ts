import { ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

/**
 * Baseline (pre-mod) build stat calculations. Formulas are reverse-engineered
 * from the old site's (seurimas.github.io/starmourn-ship-builder) live output
 * for a known calibration build — see stats-engine.spec.ts for the build and
 * confirmed numbers. Notably:
 * - Health = hull.strength_dam + shield.shield_strength_dam only; the `hp`
 *   field on capacitor/engine/sensor/shipsim components has no confirmed role
 *   here and isn't folded in.
 * - DPS = weapon_damage / firing_speed_s (reload_speed_s isn't factored in).
 * - Max speed is a flat 3000 for every hull (confirmed by the user, not in the
 *   data). ACCEL_SCALE corrects thrustOverMass to match real in-game
 *   acceleration timings (calibrated against a live GMCP speed log) — still an
 *   approximation since real acceleration isn't constant, hence the UI's "~".
 */

export interface BuildInput {
  hull: ShipModel;
  capacitor?: ShipComponent;
  engine?: ShipComponent;
  shield?: ShipComponent;
  shipsim?: ShipComponent;
  sensor?: ShipComponent;
  modules: ShipModule[];
  /**
   * Parallel to `modules` — whether each fitted instance is powered on. Defaults
   * to all-active when omitted. An inactive module draws no power and, if a
   * weapon, deals no damage — but still costs shipsim cycles and occupies its slot.
   */
  moduleActive?: boolean[];
}

export interface WeaponContribution {
  module: ShipModule;
  alphaStrike: number;
  dps: number;
  capDrainKear: number;
}

export interface BudgetStat {
  used: number;
  max: number;
  remaining: number;
}

/** Same across every hull — see this file's header comment. */
export const BASE_MAX_SPEED = 3000;

/** Empirical acceleration correction factor — see this file's header comment. */
export const ACCEL_SCALE = 1000;

export interface ResistanceStats {
  hullThermal: number;
  hullKinetic: number;
  hullGravitic: number;
  shieldEM: number;
  shieldKinetic: number;
  shieldGravitic: number;
}

export interface BuildStats {
  power: BudgetStat;
  cycles: BudgetStat;
  health: { hull: number; shield: number; total: number };
  alphaStrike: number;
  dps: number;
  /** Per-weapon contribution — the old site only shows a ship-wide total. */
  weaponBreakdown: WeaponContribution[];
  /** Total capacitor drain across all fitted weapons, one shot each. */
  totalCapDrainKear: number;
  mass: number;
  /** null when no engine is fitted (can't compute a thrust ratio). */
  thrustOverMass: number | null;
  turnSpeedSeconds: number;
  maxSpeed: number;
  /** null when no engine is fitted (same guard as thrustOverMass). */
  timeToMaxSpeedSeconds: number | null;
  cargoCapacityTons: number;
  resistances: ResistanceStats;
  /** 0 when no sensor is fitted. */
  sensorJamStrength: number;
  /** 0 when no shield is fitted. */
  shieldRechargeSeconds: number;
  /** 0 when no capacitor is fitted. */
  capacitance: number;
  price: number;
}

function fittedComponents(build: BuildInput): ShipComponent[] {
  return [build.capacitor, build.engine, build.shield, build.shipsim, build.sensor].filter(
    (c): c is ShipComponent => c != null,
  );
}

export function calculateBuildStats(build: BuildInput): BuildStats {
  const components = fittedComponents(build);
  const isActive = (index: number) => build.moduleActive?.[index] ?? true;

  const powerUsed =
    components.reduce((sum, c) => sum + c.power_need_halons, 0) +
    build.modules.reduce((sum, m, i) => sum + (isActive(i) ? m.power_use_halons : 0), 0);
  const powerMax = build.hull.power_halons;

  const cyclesUsed = build.modules.reduce((sum, m) => sum + m.shipsim_cycles, 0);
  const cyclesMax = build.shipsim?.max_cycles ?? 0;

  const hullHealth = build.hull.strength_dam;
  const shieldHealth = build.shield?.shield_strength_dam ?? 0;

  const weaponBreakdown: WeaponContribution[] = build.modules
    .map((module, index) => ({ module, active: isActive(index) }))
    .filter((e) => e.module.weapon_module === 'Yes')
    .map(({ module, active }) => ({
      module,
      alphaStrike: active ? (module.weapon_damage ?? 0) : 0,
      dps: active && module.firing_speed_s ? (module.weapon_damage ?? 0) / module.firing_speed_s : 0,
      capDrainKear: active ? (module.cap_drain_kear ?? 0) : 0,
    }));

  const mass =
    build.hull.mass_tons +
    components.reduce((sum, c) => sum + c.mass_tons, 0) +
    build.modules.reduce((sum, m) => sum + m.mass_tons, 0);

  const price =
    build.hull.price_marks +
    components.reduce((sum, c) => sum + c.price_marks, 0) +
    build.modules.reduce((sum, m) => sum + m.price_marks, 0);

  const thrustOverMass = build.engine ? (build.engine.thrust_halons ?? 0) / mass : null;

  return {
    power: { used: powerUsed, max: powerMax, remaining: powerMax - powerUsed },
    cycles: { used: cyclesUsed, max: cyclesMax, remaining: cyclesMax - cyclesUsed },
    health: { hull: hullHealth, shield: shieldHealth, total: hullHealth + shieldHealth },
    alphaStrike: weaponBreakdown.reduce((sum, w) => sum + w.alphaStrike, 0),
    dps: weaponBreakdown.reduce((sum, w) => sum + w.dps, 0),
    weaponBreakdown,
    totalCapDrainKear: weaponBreakdown.reduce((sum, w) => sum + w.capDrainKear, 0),
    mass,
    thrustOverMass,
    turnSpeedSeconds: build.hull.turn_time_s,
    maxSpeed: BASE_MAX_SPEED,
    timeToMaxSpeedSeconds: thrustOverMass ? BASE_MAX_SPEED / (thrustOverMass * ACCEL_SCALE) : null,
    cargoCapacityTons: build.hull.capacity_tons,
    resistances: {
      hullThermal: build.hull.therm_res,
      hullKinetic: build.hull.kin_res,
      hullGravitic: build.hull.grav_res,
      shieldEM: build.shield?.em_res ?? 0,
      shieldKinetic: build.shield?.kin_res ?? 0,
      shieldGravitic: build.shield?.grav_res ?? 0,
    },
    sensorJamStrength: build.sensor?.jam_str ?? 0,
    shieldRechargeSeconds: build.shield?.recharge_s ?? 0,
    capacitance: build.capacitor?.capacity_kear ?? 0,
    price,
  };
}
