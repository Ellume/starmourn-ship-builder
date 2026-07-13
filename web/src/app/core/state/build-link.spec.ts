import { afterEach, describe, expect, it } from 'vitest';
import { applySharedBuildFromUrl, buildShareUrl, encodeBuild, hasSharedBuildInUrl } from './build-link';
import { BuildStore } from './build.store';
import { DataService } from '../data/data.service';
import { ShipComponent } from '../models/component';
import { ShipModel } from '../models/ship-model';
import { ShipModule } from '../models/module';
import { ShipModSummary } from '../models/ship-mod';

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

const capacitor: ShipComponent = {
  type: 'Capacitor',
  id: 1,
  make: 'Relian Shipyards',
  model: 'R1000',
  class: 'Interceptor',
  mass_tons: 375,
  power_need_halons: 300,
  capacity_kear: 1500,
  thrust_halons: null,
  sensor_strength: null,
  shield_strength_dam: null,
  hp: 300,
  jam_str: null,
  recharge_s: null,
  grav_res: null,
  kin_res: null,
  em_res: null,
  antipierce: null,
  max_cycles: null,
  price_marks: 5000,
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

const hullAugment: ShipModSummary = {
  shortname: 'hull_augment',
  full_name: 'Hull Augment',
  family: 'Superstructure Modification',
  manufacturer: '',
  info: '',
  effect_level_1: '',
  effect_level_15: '',
  parts_level_1: '',
  parts_level_15: '',
  class_cost_multiplier_note: '',
  notes: null,
};

function fakeData(): DataService {
  return {
    shipModels: () => [hull],
    componentsByType: (type: string) => (type === 'Capacitor' ? [capacitor] : []),
    modules: () => [cannon],
    shipMods: () => [hullAugment],
  } as unknown as DataService;
}

describe('build-link', () => {
  afterEach(() => {
    history.pushState('', '', '/');
  });

  it('round-trips a build (hull, component, duplicate modules, mod) through encode/decode', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.capacitor.set(capacitor);
    build.addModule(cannon);
    build.addModule(cannon);
    build.addMod('hull_augment');
    build.setModLevel('hull_augment', 7);

    const url = buildShareUrl(build);
    const [, query] = url.split('?');
    history.pushState('', '', `?${query}`);

    expect(hasSharedBuildInUrl()).toBe(true);
    const restored = new BuildStore();
    const ok = applySharedBuildFromUrl(restored, fakeData());

    expect(ok).toBe(true);
    expect(restored.hull()?.id).toBe(20);
    expect(restored.capacitor()?.id).toBe(1);
    expect(restored.modules().map((m) => m.id)).toEqual([4, 4]);
    expect(restored.mods()).toEqual([{ shortname: 'hull_augment', level: 7 }]);
  });

  it('returns an empty token (bare URL) when no hull is selected', () => {
    const build = new BuildStore();
    expect(encodeBuild(build)).toBe('');
  });

  it('skips unknown mod shortnames and out-of-range levels rather than throwing', () => {
    const build = new BuildStore();
    build.setHull(hull);
    history.pushState('', '', '?h=20&mo=not_a_real_mod:5,hull_augment:99');

    const ok = applySharedBuildFromUrl(build, fakeData());

    expect(ok).toBe(true);
    expect(build.mods()).toEqual([]);
  });

  it('encodes as plain, human-readable query params rather than a JSON blob', () => {
    const build = new BuildStore();
    build.setHull(hull);
    build.capacitor.set(capacitor);
    build.addModule(cannon);
    build.addModule(cannon);
    build.addMod('hull_augment');

    expect(encodeBuild(build)).toBe('h=20&c=1&m=4,4&mo=hull_augment:1');
  });
});
