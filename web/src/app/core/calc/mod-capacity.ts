/**
 * Capacity/validation rules for the crafted Mods system (data/ship-mods.json),
 * confirmed by the user (an active player) — see the project-game-mechanics
 * memory. Distinct from the Modules hardpoint/mod_cap points model in capacity.ts:
 * mods use a flat 6-slot count plus a shared level-sum budget instead of per-item
 * size points.
 */

export interface FittedMod {
  shortname: string;
  level: number;
}

export const MOD_SLOT_MAX = 6;
/** Soft budget — going over is allowed (each mod still ranges freely 1-15), it just flags red as a warning, like Power/Cycles. */
export const MOD_LEVEL_BUDGET = 60;
export const MOD_LEVEL_MIN = 1;
export const MOD_LEVEL_MAX = 15;

/**
 * Mutually exclusive with each other — trade one ship-wide capacity stat for
 * another. See data/ship-mods-notes.md "Facts". In-game these also require all
 * modules uninstalled to install/remove, but this tool is a design aid, not a
 * simulator of that specific restriction: hardpoint/module capacity are a
 * warn-only budget here (see loadout-editor.ts), so adding/removing one of these
 * mods with weapons/modules already fitted is allowed and just re-evaluates
 * whether you're over budget, the same as any other capacity-changing edit.
 */
export const CAPACITY_TRADE_MODS: readonly string[] = [
  'expanded_hardpoints',
  'expanded_modulebay',
  'cargohold_optimizer',
];

/**
 * Each `*_optimize` mod blocks other mods on the same component/weapon type.
 * Keyed by the optimize mod's shortname; values are the shortnames it locks out.
 * Confirmed pairing (not a blanket family-wide rule) — e.g. engine_optimize
 * blocks engine_bulwark/engine_overclock but NOT max_speed, even though all
 * three share the "Engine Modification" family. See project-game-mechanics memory.
 */
export const OPTIMIZE_LOCKOUTS: Record<string, string[]> = {
  capacitor_optimize: ['capacitor_bulwark', 'capacitor_overclock'],
  engine_optimize: ['engine_bulwark', 'engine_overclock'],
  sensor_optimize: ['sensor_bulwark', 'sensor_overclock'],
  shield_optimize: [
    'shield_augment',
    'shield_recharge',
    'shield_redundancy',
    'shield_res_em',
    'shield_res_gravitic',
    'shield_res_kinetic',
  ],
  shipsim_optimize: ['shipsim_bulwark', 'shipsim_overclock'],
  cannon_optimize: ['cannon_attenuate'],
  laser_optimize: ['laser_attenuate'],
  missile_optimize: ['missile_attenuate'],
  turret_optimize: ['turret_attenuate'],
};

export function modLevelSum(mods: FittedMod[]): number {
  return mods.reduce((sum, m) => sum + m.level, 0);
}

/** Shortnames among `installed` that `shortname` cannot coexist with. */
export function conflictsFor(shortname: string, installed: FittedMod[]): string[] {
  const installedNames = installed.map((m) => m.shortname);
  const conflicts = new Set<string>();

  if (CAPACITY_TRADE_MODS.includes(shortname)) {
    for (const other of CAPACITY_TRADE_MODS) {
      if (other !== shortname && installedNames.includes(other)) conflicts.add(other);
    }
  }

  const lockedOutByThis = OPTIMIZE_LOCKOUTS[shortname] ?? [];
  for (const other of lockedOutByThis) {
    if (installedNames.includes(other)) conflicts.add(other);
  }

  for (const [optimizeName, lockedOut] of Object.entries(OPTIMIZE_LOCKOUTS)) {
    if (lockedOut.includes(shortname) && installedNames.includes(optimizeName)) {
      conflicts.add(optimizeName);
    }
  }

  return [...conflicts];
}

export interface ModAddCheck {
  ok: boolean;
  reason?: string;
}

/** Can `shortname` be added (at its default/minimum level of 1) to `installed`? */
export function canAddMod(shortname: string, installed: FittedMod[]): ModAddCheck {
  if (installed.some((m) => m.shortname === shortname)) {
    return { ok: false, reason: 'Already installed.' };
  }
  if (installed.length >= MOD_SLOT_MAX) {
    return { ok: false, reason: `All ${MOD_SLOT_MAX} mod slots are full.` };
  }
  const conflicts = conflictsFor(shortname, installed);
  if (conflicts.length) {
    return { ok: false, reason: `Conflicts with ${conflicts.join(', ')}.` };
  }
  return { ok: true };
}
