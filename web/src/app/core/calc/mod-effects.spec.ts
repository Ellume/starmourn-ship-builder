import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeModdedStats, ModEffectSource, OTHER_EFFECT_REASONS, STAT_TARGETS } from './mod-effects';
import { ACCEL_SCALE } from './stats-engine';
import { parseEffectText } from '../models/mod-effect-parser';
import { ShipModLevelRaw } from '../models/ship-mod';
import { ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

function loadData<T>(filename: string): T {
  const path = resolve(process.cwd(), '../data', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('STAT_TARGETS / OTHER_EFFECT_REASONS completeness', () => {
  it('accounts for every canonical stat name produced by parsing all 750 real mod rows', () => {
    const rows = loadData<ShipModLevelRaw[]>('ship-mod-levels.json');
    const seen = new Set<string>();
    for (const row of rows) {
      for (const effect of parseEffectText(row.effect)) seen.add(effect.stat);
    }
    const unaccounted = [...seen].filter((stat) => !(stat in STAT_TARGETS) && !(stat in OTHER_EFFECT_REASONS));
    expect(unaccounted).toEqual([]);
  });
});

describe('computeModdedStats', () => {
  const models = loadData<ShipModel[]>('ship-models.json');
  const components = loadData<ShipComponent[]>('components.json');
  const modules = loadData<ShipModule[]>('modules.json');

  const hull = models.find((m) => m.id === 20)!;
  const capacitor = components.find((c) => c.type === 'Capacitor' && c.id === 3 && c.class === 'Interceptor')!;
  const engine = components.find((c) => c.type === 'Engine' && c.id === 23 && c.class === 'Interceptor')!;
  const shield = components.find((c) => c.type === 'Shield' && c.id === 1 && c.class === 'Interceptor')!;
  const shipsim = components.find((c) => c.type === 'Shipsim' && c.id === 3 && c.class === 'Interceptor')!;
  const sensor = components.find((c) => c.type === 'Sensor' && c.id === 1 && c.class === 'Interceptor')!;
  const cannon1 = modules.find((m) => m.id === 4)!;
  const cargoHold1 = modules.find((m) => m.id === 27)!;
  const cargoHold2 = modules.find((m) => m.id === 41)!;

  const build = { hull, capacitor, engine, shield, shipsim, sensor, modules: [] as ShipModule[] };

  it('matches baseline stats-engine output when no mods are fitted', () => {
    const modded = computeModdedStats(build, []);
    expect(modded.mass.final).toBe(modded.baseline.mass);
    expect(modded.thrustOverMass!.final).toBeCloseTo(modded.baseline.thrustOverMass!, 6);
    expect(modded.turnSpeedSeconds.final).toBe(modded.baseline.turnSpeedSeconds);
    expect(modded.health.total).toBe(modded.baseline.health.total);
    expect(modded.power.used.final).toBe(modded.baseline.power.used);
    expect(modded.other).toEqual([]);
  });

  it('applies a mass-only mod (mass_reducer) to hull mass and downstream thrust/mass', () => {
    // Real level-1 text: "-2.80% superstructure mass"
    const modSources: ModEffectSource[] = [
      { modName: 'Mass Reducer', level: 1, effects: parseEffectText('-2.80% superstructure mass') },
    ];
    const modded = computeModdedStats(build, modSources);

    expect(modded.mass.base).toBe(modded.baseline.mass);
    expect(modded.mass.contributions).toEqual([{ modName: 'Mass Reducer', level: 1, deltaPct: -2.8 }]);
    const expectedHullMass = hull.mass_tons * (1 - 0.028);
    expect(modded.mass.final).toBeCloseTo(modded.baseline.mass - hull.mass_tons + expectedHullMass, 6);

    // Thrust is untouched but mass shrank, so thrust/mass should rise.
    expect(modded.thrustOverMass!.final).toBeGreaterThan(modded.baseline.thrustOverMass!);
  });

  it('applies a tradeoff mod (hull_augment: +hp, +mass) with both a positive and a negative-feeling delta on the same mod', () => {
    // Real level-1 text: "+1.40% to hull hit points, +1.75% to superstructure mass"
    const modSources: ModEffectSource[] = [
      { modName: 'Hull Augment', level: 1, effects: parseEffectText('+1.40% to hull hit points, +1.75% to superstructure mass') },
    ];
    const modded = computeModdedStats(build, modSources);

    expect(modded.health.hull.final).toBeCloseTo(hull.strength_dam * 1.014, 6);
    expect(modded.health.hull.contributions).toEqual([{ modName: 'Hull Augment', level: 1, deltaPct: 1.4 }]);
    expect(modded.mass.contributions).toEqual([{ modName: 'Hull Augment', level: 1, deltaPct: 1.75 }]);
  });

  it('applies a weapon-family mod (cannon damage) only to fitted cannons, via weaponBreakdown-equivalent totals', () => {
    const withCannon = { ...build, modules: [cannon1] };
    const modSources: ModEffectSource[] = [
      { modName: 'Cannon Overclock', level: 1, effects: parseEffectText('+9.90% cannon damage, +3.30% cannon halon cost') },
    ];
    const modded = computeModdedStats(withCannon, modSources);

    expect(modded.alphaStrike.final).toBeCloseTo((cannon1.weapon_damage ?? 0) * 1.099, 6);
    expect(modded.alphaStrike.contributions).toEqual([{ modName: 'Cannon Overclock', level: 1, deltaPct: 9.9 }]);
    expect(modded.power.used.final).toBeGreaterThan(modded.baseline.power.used);
  });

  it('applies a max-speed mod on top of the shared 3000 constant, and recomputes time-to-max-speed', () => {
    // Real level-1 text: "+2.10% maximum speed, +0.70% engine halon cost"
    const modSources: ModEffectSource[] = [
      { modName: 'Max Speed', level: 1, effects: parseEffectText('+2.10% maximum speed, +0.70% engine halon cost') },
    ];
    const modded = computeModdedStats(build, modSources);

    expect(modded.baseline.maxSpeed).toBe(3000);
    expect(modded.maxSpeed.final).toBeCloseTo(3000 * 1.021, 6);
    // Engine halon cost doesn't touch thrust or mass, so thrust/mass is unchanged —
    // time-to-max-speed moves purely because the speed cap itself rose.
    expect(modded.thrustOverMass!.final).toBeCloseTo(modded.baseline.thrustOverMass!, 6);
    expect(modded.timeToMaxSpeedSeconds!.final).toBeCloseTo(modded.maxSpeed.final / (modded.thrustOverMass!.final * ACCEL_SCALE), 6);
    expect(modded.power.used.final).toBeGreaterThan(modded.baseline.power.used);
  });

  it('buckets a genuinely unmapped stat (capacitor hit points) into `other` with a reason, instead of dropping it', () => {
    // Real capacitor_bulwark level-1 text.
    const modSources: ModEffectSource[] = [
      { modName: 'Capacitor Bulwarks', level: 1, effects: parseEffectText('+5.25% capacitor hit points, +1.75% capacitor mass') },
    ];
    const modded = computeModdedStats(build, modSources);

    expect(modded.other).toEqual([
      {
        modName: 'Capacitor Bulwarks',
        level: 1,
        stat: 'capacitor hit points',
        deltaPct: 5.25,
        reason: OTHER_EFFECT_REASONS['capacitor hit points'],
      },
    ]);
    // The capacitor mass half of the same effect line is still mapped and applied.
    expect(modded.mass.contributions).toEqual([{ modName: 'Capacitor Bulwarks', level: 1, deltaPct: 1.75 }]);
  });

  it('applies hull resistance mods additively (percentage points), not as a multiplier of a 0 base', () => {
    // Real hull_res_thermal level-1 text: raises thermal, lowers gravitic+kinetic as a tradeoff.
    const modSources: ModEffectSource[] = [
      {
        modName: 'Hull Resistance (Thermal)',
        level: 1,
        effects: parseEffectText('+2.10% hull thermal resistance, -0.70% hull gravitic and kinetic resistance'),
      },
    ];
    const modded = computeModdedStats(build, modSources);

    // Every hull's base resistance is 0 — a multiplicative delta would leave it at 0 forever.
    expect(hull.therm_res).toBe(0);
    expect(modded.resistances.hullThermal.final).toBe(2.1);
    expect(modded.resistances.hullGravitic.final).toBe(-0.7);
    expect(modded.resistances.hullKinetic.final).toBe(-0.7);
  });

  it('applies a cargo-capacity mod, and its hardpoint/module capacity tradeoff cuts both budgets directly', () => {
    // Real cargohold_optimizer level-1 text.
    const modSources: ModEffectSource[] = [
      {
        modName: 'Cargohold Optimizer',
        level: 1,
        effects: parseEffectText('+2.10% cargohold capacity, -1.40% hardpoint and module capacity'),
      },
    ];
    const modded = computeModdedStats(build, modSources);

    expect(modded.cargoCapacityTons.base).toBe(hull.capacity_tons);
    expect(modded.cargoCapacityTons.final).toBeCloseTo(hull.capacity_tons * 1.021, 6);
    expect(modded.hardpoints.max.final).toBe(Math.floor(hull.hardpoints * (1 - 0.014)));
    expect(modded.modCap.max.final).toBe(Math.floor(hull.mod_cap * (1 - 0.014)));
    expect(modded.other).toEqual([]);
  });

  it('converts hardpoint capacity into module capacity (expanded_modulebay) as a linked pair, not two independent boosts', () => {
    // Real expanded_modulebay level-1 text.
    const modSources: ModEffectSource[] = [
      { modName: 'Expanded Module Bay', level: 1, effects: parseEffectText('+1.75% hardpoint capacity replaced as module capacity') },
    ];
    const modded = computeModdedStats(build, modSources);

    const converted = hull.hardpoints * 0.0175;
    expect(modded.hardpoints.max.final).toBe(Math.floor(hull.hardpoints - converted));
    expect(modded.modCap.max.final).toBe(Math.floor(hull.mod_cap + converted));
    expect(modded.hardpoints.max.contributions).toEqual([{ modName: 'Expanded Module Bay', level: 1, deltaPct: -1.75 }]);
    expect(modded.modCap.max.contributions).toEqual([{ modName: 'Expanded Module Bay', level: 1, deltaPct: 1.75 }]);
  });

  it('reflects fitted-module usage against the (possibly modded) capacity max, remaining can go negative', () => {
    const withCannon = { ...build, modules: [cannon1] };
    const modded = computeModdedStats(withCannon, []);
    expect(modded.hardpoints.used).toBe(5); // small module = 5pt
    expect(modded.hardpoints.remaining).toBe(hull.hardpoints - 5);
  });

  it('applies a weapon kear-cost mod to fitted weapons of that family', () => {
    // Real cannon_attenuate level-1 text.
    const withCannon = { ...build, modules: [cannon1] };
    const modSources: ModEffectSource[] = [
      { modName: 'Cannon Attenuate', level: 1, effects: parseEffectText('-2.10% cannon kear cost, -0.70% cannon damage') },
    ];
    const modded = computeModdedStats(withCannon, modSources);

    expect(modded.totalCapDrainKear.base).toBe(cannon1.cap_drain_kear);
    expect(modded.totalCapDrainKear.final).toBeCloseTo((cannon1.cap_drain_kear ?? 0) * (1 - 0.021), 6);
    expect(modded.alphaStrike.final).toBeCloseTo((cannon1.weapon_damage ?? 0) * (1 - 0.007), 6);
  });

  it('surfaces ammo-based damage-type bonuses as flat aggregated percentages, not a base/final breakdown', () => {
    // Real em_dmg level-1 text: buffs EM, trades off the other three damage types.
    const modSources: ModEffectSource[] = [
      {
        modName: 'EM Damage',
        level: 1,
        effects: parseEffectText('+2.10% EM damage, -0.70% thermal, gravitic, and kinetic damage'),
      },
    ];
    const modded = computeModdedStats(build, modSources);

    const byType = Object.fromEntries(modded.damageTypeBonuses.map((d) => [d.damageType, d.totalPct]));
    expect(byType).toEqual({ EM: 2.1, Thermal: -0.7, Gravitic: -0.7, Kinetic: -0.7 });
    expect(modded.other).toEqual([]);
  });

  it('applies a linked Damage Boost to exactly one fitted instance of a duplicated weapon, not to every instance', () => {
    const withTwoCannons = { ...build, modules: [cannon1, cannon1] };
    const modded = computeModdedStats(withTwoCannons, [], new Map([[cannon1.id, 1]]));

    const boosted = modded.weaponBreakdown.filter((w) => w.alphaStrike.contributions.length > 0);
    const unboosted = modded.weaponBreakdown.filter((w) => w.alphaStrike.contributions.length === 0);
    expect(boosted).toHaveLength(1);
    expect(unboosted).toHaveLength(1);
    expect(boosted[0].alphaStrike.final).toBeCloseTo((cannon1.weapon_damage ?? 0) * 1.1, 6);
    expect(unboosted[0].alphaStrike.final).toBe(cannon1.weapon_damage);
    // No ship-mod level applies to a linked module effect.
    expect(boosted[0].alphaStrike.contributions).toEqual([{ modName: 'Damage Boost (linked)', level: null, deltaPct: 10 }]);
    expect(modded.alphaStrike.final).toBeCloseTo((cannon1.weapon_damage ?? 0) * 2.1, 6);
    // The ship-wide aggregate contribution must reflect the boost's *true* overall
    // share (here, half the weapons boosted at +10% each = +5% overall), not the
    // raw +10% that only applies to the one boosted weapon.
    expect(modded.alphaStrike.contributions).toEqual([{ modName: 'Damage Boost (linked)', level: null, deltaPct: 5 }]);
  });

  it('boosts both instances of a duplicated weapon when two boosts are linked to that weapon type', () => {
    const withTwoCannons = { ...build, modules: [cannon1, cannon1] };
    const modded = computeModdedStats(withTwoCannons, [], new Map([[cannon1.id, 2]]));

    expect(modded.weaponBreakdown.every((w) => w.alphaStrike.contributions.length === 1)).toBe(true);
    expect(modded.alphaStrike.final).toBeCloseTo((cannon1.weapon_damage ?? 0) * 2 * 1.1, 6);
    // Every weapon boosted equally — the aggregate % should reduce to the same raw +10%.
    expect(modded.alphaStrike.contributions).toEqual([
      { modName: 'Damage Boost (linked)', level: null, deltaPct: 10, count: 2 },
    ]);
  });

  it('adds a fitted Cargo Hold module\'s flat tons bonus to cargo capacity', () => {
    const withCargoHold = { ...build, modules: [cargoHold1] };
    const modded = computeModdedStats(withCargoHold, []);

    expect(modded.cargoCapacityTons.final).toBeCloseTo(hull.capacity_tons + 100, 6);
    expect(modded.cargoCapacityTons.contributions).toHaveLength(1);
    expect(modded.cargoCapacityTons.contributions[0].modName).toBe('Cargo Hold I');
    expect(modded.cargoCapacityTons.contributions[0].level).toBeNull();
    expect(modded.cargoCapacityTons.contributions[0].count).toBe(1);
  });

  it('sums two fitted instances of the same Cargo Hold module into one combined contribution, not one dropped', () => {
    const withTwoCargoHolds = { ...build, modules: [cargoHold1, cargoHold1] };
    const modded = computeModdedStats(withTwoCargoHolds, []);

    expect(modded.cargoCapacityTons.final).toBeCloseTo(hull.capacity_tons + 200, 6);
    expect(modded.cargoCapacityTons.contributions).toHaveLength(1);
    expect(modded.cargoCapacityTons.contributions[0].count).toBe(2);
  });

  it('combines a flat Cargo Hold bonus with a percentage ship-mod cargo bonus against the same unmodified base', () => {
    const withBoth = { ...build, modules: [cargoHold1, cargoHold2] };
    const modSources: ModEffectSource[] = [
      { modName: 'Cargohold Optimizer', level: 1, effects: parseEffectText('+2.10% cargohold capacity') },
    ];
    const modded = computeModdedStats(withBoth, modSources);

    const expectedFinal = hull.capacity_tons * 1.021 + 100 + 150;
    expect(modded.cargoCapacityTons.final).toBeCloseTo(expectedFinal, 6);
    expect(modded.cargoCapacityTons.contributions).toHaveLength(3);
  });
});
