import { describe, expect, it } from 'vitest';
import { BuildStore } from './build.store';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

const hull: ShipModel = {
  id: 20,
  make: 'Akari Yards',
  model: 'Corsair',
  class: 'Interceptor',
  size: 7,
  mass_tons: 1400,
  strength_dam: 704,
  turn_time_s: 0.31,
  capacity_tons: 1800,
  power_halons: 2600,
  refit_cap: 2,
  hardpoints: 5,
  mod_cap: 5,
  therm_res: 0,
  kin_res: 0,
  grav_res: 0,
  price_marks: 17527,
  notes: null,
};

const cannon: ShipModule = {
  id: 4,
  size: 'small',
  name: 'Cannon I',
  weapon_module: 'Yes',
  weapon_type: 'cannon',
  classes: ['Interceptor'],
  description: '',
  mass_tons: 0,
  power_use_halons: 100,
  shipsim_cycles: 1000,
  firing_speed_s: 3,
  weapon_damage: 300,
  cap_drain_kear: 150,
  reload_speed_s: 3,
  optimal_range: 6,
  fall_off: 15,
  use_no_ammo: null,
  cooldown_s: null,
  effect_bonus: null,
  price_marks: 3000,
  notes: null,
};

const damageBoost: ShipModule = {
  id: 20,
  size: 'medium',
  name: 'Damage Boost',
  weapon_module: 'No',
  weapon_type: null,
  classes: ['Interceptor'],
  description: '',
  mass_tons: 0,
  power_use_halons: 100,
  shipsim_cycles: 0,
  firing_speed_s: null,
  weapon_damage: null,
  cap_drain_kear: null,
  reload_speed_s: null,
  optimal_range: null,
  fall_off: null,
  use_no_ammo: null,
  cooldown_s: null,
  effect_bonus: '+10.00% damage; +30.00% linked module capacitor drain',
  price_marks: 50000,
  notes: null,
};

describe('BuildStore — moduleActive', () => {
  it('defaults every newly-fitted module to active, and setModuleActive flips one instance by index', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.addModule(cannon);
    build.addModule(cannon);

    expect(build.moduleActive()).toEqual([true, true]);

    build.setModuleActive(0, false);
    expect(build.moduleActive()).toEqual([false, true]);
    // The other fitted instance (same reference) is untouched.
    expect(build.modules()).toEqual([cannon, cannon]);
  });

  it('keeps moduleActive in sync (by position) when a module is removed', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.addModule(cannon);
    build.addModule(cannon);
    build.setModuleActive(0, false);

    // removeModule drops the first matching instance (index 0) — its active flag should go with it.
    build.removeModule(cannon);
    expect(build.modules()).toEqual([cannon]);
    expect(build.moduleActive()).toEqual([true]);
  });

  it('clears moduleActive on hull change/reset, same as modules', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.addModule(cannon);
    build.setModuleActive(0, false);

    build.setHull(hull);
    expect(build.modules()).toEqual([]);
    expect(build.moduleActive()).toEqual([]);
  });

  it('damageBoostCounts ignores a link whose own Damage Boost module has been switched off', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.addModule(cannon);
    build.addModule(damageBoost);
    build.setDamageBoostLink(0, cannon.id);

    expect(build.damageBoostCounts()).toEqual(new Map([[cannon.id, 1]]));

    // Damage Boost is index 1 in `modules` (fitted after the cannon).
    build.setModuleActive(1, false);
    expect(build.damageBoostCounts()).toEqual(new Map());

    build.setModuleActive(1, true);
    expect(build.damageBoostCounts()).toEqual(new Map([[cannon.id, 1]]));
  });

  it('damageBoostCounts still ignores a link whose target weapon is no longer fitted (unaffected by the active gating)', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.addModule(cannon);
    build.addModule(damageBoost);
    build.setDamageBoostLink(0, cannon.id);
    build.removeModule(cannon);

    expect(build.damageBoostCounts()).toEqual(new Map());
  });
});
