import { ModuleSize, ShipModule } from '../models/module';

/**
 * Points a module of a given size consumes against a hull's hardpoints (weapon
 * modules) or mod_cap (non-weapon modules) budget. Confirmed from the old site's
 * embedded data (every module in the dataset uses exactly one of these three
 * values, no exceptions) — data/modules.json doesn't carry this field itself.
 */
export const MODULE_SIZE_POINTS: Record<ModuleSize, number> = {
  small: 5,
  medium: 10,
  large: 15,
};

export function hardpointPointsUsed(modules: ShipModule[]): number {
  return modules.filter((m) => m.weapon_module === 'Yes').reduce((sum, m) => sum + MODULE_SIZE_POINTS[m.size], 0);
}

export function modCapPointsUsed(modules: ShipModule[]): number {
  return modules.filter((m) => m.weapon_module === 'No').reduce((sum, m) => sum + MODULE_SIZE_POINTS[m.size], 0);
}
