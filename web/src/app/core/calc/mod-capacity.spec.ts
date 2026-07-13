import { describe, expect, it } from 'vitest';
import { CAPACITY_TRADE_MODS, FittedMod, canAddMod, canRemoveMod, conflictsFor, modLevelSum } from './mod-capacity';

describe('modLevelSum', () => {
  it('sums installed mod levels', () => {
    const mods: FittedMod[] = [
      { shortname: 'a', level: 5 },
      { shortname: 'b', level: 10 },
    ];
    expect(modLevelSum(mods)).toBe(15);
  });
});

describe('conflictsFor', () => {
  it('flags the capacity-trade mods against each other', () => {
    const installed: FittedMod[] = [{ shortname: 'expanded_hardpoints', level: 1 }];
    expect(conflictsFor('expanded_modulebay', installed)).toEqual(['expanded_hardpoints']);
    expect(conflictsFor('cargohold_optimizer', installed)).toEqual(['expanded_hardpoints']);
  });

  it('is symmetric for optimize lockouts regardless of install order', () => {
    expect(conflictsFor('engine_bulwark', [{ shortname: 'engine_optimize', level: 1 }])).toEqual(['engine_optimize']);
    expect(conflictsFor('engine_optimize', [{ shortname: 'engine_bulwark', level: 1 }])).toEqual(['engine_bulwark']);
  });

  it('does not flag max_speed against engine_optimize (confirmed exception, not a family-wide lockout)', () => {
    expect(conflictsFor('max_speed', [{ shortname: 'engine_optimize', level: 1 }])).toEqual([]);
    expect(conflictsFor('engine_optimize', [{ shortname: 'max_speed', level: 1 }])).toEqual([]);
  });

  it('has no conflicts for unrelated mods', () => {
    expect(conflictsFor('hull_augment', [{ shortname: 'shield_optimize', level: 1 }])).toEqual([]);
  });
});

describe('canAddMod', () => {
  it('allows adding within the slot limit', () => {
    expect(canAddMod('hull_augment', [], false)).toEqual({ ok: true });
  });

  it('rejects a duplicate shortname', () => {
    const installed: FittedMod[] = [{ shortname: 'hull_augment', level: 3 }];
    expect(canAddMod('hull_augment', installed, false).ok).toBe(false);
  });

  it('rejects once 6 slots are full', () => {
    const installed: FittedMod[] = Array.from({ length: 6 }, (_, i) => ({ shortname: `mod${i}`, level: 1 }));
    const result = canAddMod('hull_augment', installed, false);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/slots/);
  });

  it('allows adding even when it would push the level sum over the 60 budget (soft budget, not a hard block)', () => {
    const installed: FittedMod[] = [{ shortname: 'hull_augment', level: 60 }];
    expect(canAddMod('mass_reducer', installed, false)).toEqual({ ok: true });
  });

  it('rejects a capacity-trade mod while modules are fitted', () => {
    const result = canAddMod('expanded_hardpoints', [], true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/modules uninstalled/);
  });

  it('allows a capacity-trade mod when no modules are fitted and no other trade mod is installed', () => {
    expect(canAddMod('expanded_hardpoints', [], false)).toEqual({ ok: true });
  });

  it('rejects an optimize mod that conflicts with an already-installed mod', () => {
    const result = canAddMod('shield_optimize', [{ shortname: 'shield_augment', level: 1 }], false);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/shield_augment/);
  });
});

describe('canRemoveMod', () => {
  it('rejects removing a capacity-trade mod while modules are fitted', () => {
    const result = canRemoveMod('expanded_hardpoints', true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/modules uninstalled/);
  });

  it('allows removing a capacity-trade mod when no modules are fitted', () => {
    expect(canRemoveMod('expanded_hardpoints', false)).toEqual({ ok: true });
  });

  it('allows removing a non-capacity-trade mod regardless of fitted modules', () => {
    expect(canRemoveMod('hull_augment', true)).toEqual({ ok: true });
  });
});

describe('CAPACITY_TRADE_MODS', () => {
  it('lists exactly the 3 mutually-exclusive capacity-trade mods', () => {
    expect(CAPACITY_TRADE_MODS).toEqual(['expanded_hardpoints', 'expanded_modulebay', 'cargohold_optimizer']);
  });
});
