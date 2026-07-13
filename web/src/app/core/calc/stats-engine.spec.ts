import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateBuildStats } from './stats-engine';
import { ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

function loadData<T>(filename: string): T {
  const path = resolve(process.cwd(), '../data', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// Calibration build: hull id 20 (Akari Yards Corsair) + capacitor 3 + engine 23 +
// shield 1 + shipsim 3 + sensor 1 [+ Cannon I module id 4], matched stat-for-stat
// against the old site's live output for this exact build (see stats-engine.ts's
// header comment). Every field these formulas touch is identical between the old
// site's stale snapshot and our current data for this build except turn_time_s and
// sensor_strength (real game rebalances since the old capture) — neither of which
// this baseline engine's assertions below depend on for a hardcoded expected value.
describe('calculateBuildStats — calibration build (hull 20 + capacitor 3 + engine 23 + shield 1 + shipsim 3 + sensor 1)', () => {
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

  it('fixture rows exist', () => {
    expect(hull).toBeDefined();
    expect(capacitor).toBeDefined();
    expect(engine).toBeDefined();
    expect(shield).toBeDefined();
    expect(shipsim).toBeDefined();
    expect(sensor).toBeDefined();
    expect(cannon1).toBeDefined();
  });

  it('matches the old site with no modules fitted (Power 250/2600, Health 2704, Mass 2925, Price 24424)', () => {
    const stats = calculateBuildStats({ hull, capacitor, engine, shield, shipsim, sensor, modules: [] });

    expect(stats.power).toEqual({ used: 2350, max: 2600, remaining: 250 });
    expect(stats.cycles).toEqual({ used: 0, max: 1000, remaining: 1000 });
    expect(stats.health).toEqual({ hull: 704, shield: 2000, total: 2704 });
    expect(stats.alphaStrike).toBe(0);
    expect(stats.dps).toBe(0);
    expect(stats.mass).toBe(2925);
    expect(stats.thrustOverMass).toBeCloseTo(0.6496, 3); // old site displays this rounded to 0.650
    expect(stats.turnSpeedSeconds).toBe(hull.turn_time_s);
    expect(stats.maxSpeed).toBe(3000);
    expect(stats.timeToMaxSpeedSeconds).toBeCloseTo(4.61842, 5);
    expect(stats.cargoCapacityTons).toBe(hull.capacity_tons);
    expect(stats.resistances).toEqual({
      hullThermal: hull.therm_res,
      hullKinetic: hull.kin_res,
      hullGravitic: hull.grav_res,
      shieldEM: shield.em_res,
      shieldKinetic: shield.kin_res,
      shieldGravitic: shield.grav_res,
    });
    expect(stats.sensorJamStrength).toBe(sensor.jam_str);
    expect(stats.shieldRechargeSeconds).toBe(shield.recharge_s);
    expect(stats.capacitance).toBe(capacitor.capacity_kear);
    expect(stats.totalCapDrainKear).toBe(0);
    expect(stats.price).toBe(24424);
  });

  it('matches the old site with a Cannon I fitted (Power 150/2600, Cycles 0/1000, Alpha Strike 300, DPS 100, Price 27424)', () => {
    const stats = calculateBuildStats({
      hull,
      capacitor,
      engine,
      shield,
      shipsim,
      sensor,
      modules: [cannon1],
    });

    expect(stats.power).toEqual({ used: 2450, max: 2600, remaining: 150 });
    expect(stats.cycles).toEqual({ used: 1000, max: 1000, remaining: 0 });
    expect(stats.alphaStrike).toBe(300);
    expect(stats.dps).toBe(100);
    expect(stats.weaponBreakdown).toEqual([
      { module: cannon1, alphaStrike: 300, dps: 100, capDrainKear: cannon1.cap_drain_kear },
    ]);
    expect(stats.totalCapDrainKear).toBe(cannon1.cap_drain_kear);
    expect(stats.mass).toBe(2925); // modules always carry 0 mass_tons in this data
    expect(stats.price).toBe(27424);
  });
});

describe('calculateBuildStats — edge cases', () => {
  const hull: ShipModel = {
    id: 1,
    make: 'Test',
    model: 'Hull',
    class: 'Interceptor',
    size: 1,
    mass_tons: 1000,
    strength_dam: 500,
    turn_time_s: 1,
    capacity_tons: 100,
    power_halons: 1000,
    refit_cap: 1,
    hardpoints: 1,
    mod_cap: 1,
    therm_res: 0,
    kin_res: 0,
    grav_res: 0,
    price_marks: 1000,
    notes: null,
  };

  it('has a null thrustOverMass with no engine fitted', () => {
    const stats = calculateBuildStats({ hull, modules: [] });
    expect(stats.thrustOverMass).toBeNull();
  });

  it('has zeroed health/cycles with no shield or shipsim fitted', () => {
    const stats = calculateBuildStats({ hull, modules: [] });
    expect(stats.health).toEqual({ hull: 500, shield: 0, total: 500 });
    expect(stats.cycles).toEqual({ used: 0, max: 0, remaining: 0 });
  });

  it('lets power/cycles remaining go negative when over budget', () => {
    const hungryModule: ShipModule = {
      id: 1,
      size: 'small',
      name: 'Power Hog',
      weapon_module: 'No',
      weapon_type: null,
      classes: ['Battleship', 'Corvette', 'Cruiser', 'Destroyer', 'Freighter', 'Interceptor', 'Superhauler', 'Carrier'],
      description: '',
      mass_tons: 0,
      power_use_halons: 5000,
      shipsim_cycles: 5000,
      firing_speed_s: null,
      weapon_damage: null,
      cap_drain_kear: null,
      reload_speed_s: null,
      optimal_range: null,
      fall_off: null,
      use_no_ammo: null,
      cooldown_s: null,
      effect_bonus: null,
      price_marks: 0,
      notes: null,
    };
    const stats = calculateBuildStats({ hull, modules: [hungryModule] });
    expect(stats.power.remaining).toBe(-4000);
    expect(stats.cycles.remaining).toBe(-5000);
  });

  it('an inactive module draws no power and a disabled weapon deals no damage/kear, but shipsim cycles are unaffected', () => {
    const weaponModule: ShipModule = {
      id: 2,
      size: 'small',
      name: 'Test Cannon',
      weapon_module: 'Yes',
      weapon_type: 'cannon',
      classes: ['Interceptor'],
      description: '',
      mass_tons: 0,
      power_use_halons: 100,
      shipsim_cycles: 1000,
      firing_speed_s: 2,
      weapon_damage: 200,
      cap_drain_kear: 50,
      reload_speed_s: 2,
      optimal_range: 6,
      fall_off: 15,
      use_no_ammo: null,
      cooldown_s: null,
      effect_bonus: null,
      price_marks: 0,
      notes: null,
    };

    const active = calculateBuildStats({ hull, modules: [weaponModule], moduleActive: [true] });
    expect(active.power.used).toBe(100);
    expect(active.cycles.used).toBe(1000);
    expect(active.alphaStrike).toBe(200);
    expect(active.dps).toBe(100);
    expect(active.totalCapDrainKear).toBe(50);

    const inactive = calculateBuildStats({ hull, modules: [weaponModule], moduleActive: [false] });
    expect(inactive.power.used).toBe(0);
    expect(inactive.cycles.used).toBe(1000); // shipsim cycles are drawn regardless of active state
    expect(inactive.alphaStrike).toBe(0);
    expect(inactive.dps).toBe(0);
    expect(inactive.totalCapDrainKear).toBe(0);
    expect(inactive.weaponBreakdown).toEqual([{ module: weaponModule, alphaStrike: 0, dps: 0, capDrainKear: 0 }]);

    // Omitting moduleActive entirely defaults every module to active, matching every pre-existing caller.
    const defaulted = calculateBuildStats({ hull, modules: [weaponModule] });
    expect(defaulted.power.used).toBe(100);
    expect(defaulted.alphaStrike).toBe(200);
  });
});
