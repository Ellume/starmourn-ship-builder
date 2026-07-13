import { ShipClass } from './ship-model';

export type ModuleSize = 'small' | 'medium' | 'large';

export type WeaponType =
  | 'cannon'
  | 'turret'
  | 'missile'
  | 'laserbeam'
  | 'mine'
  | 'web'
  | 'interdictor'
  | 'signaljammer'
  | 'antimine'
  | 'tractor'
  | 'capdrainer'
  | 'cargoscanner'
  | 'slicekit';

/**
 * A hardpoint (weapon) or mod-cap (non-weapon) module bought at a shipyard.
 * Classified by `weapon_module`/`weapon_type`, not by name — e.g. Cargo Scanner
 * is a weapon module, Material Scanner is not. Source: data/modules.json
 */
export interface ShipModule {
  id: number;
  size: ModuleSize;
  name: string;
  weapon_module: 'Yes' | 'No';
  weapon_type: WeaponType | null;
  /** Ship classes that can fit this module — confirmed in-game per class's `sf modules` catalog. */
  classes: ShipClass[];
  description: string;
  /** Always 0 for every module in the source data */
  mass_tons: number;
  power_use_halons: number;
  shipsim_cycles: number;
  /** Weapon only */
  firing_speed_s: number | null;
  /** Weapon only — some weapon modules deal 0 damage (utility effect instead) */
  weapon_damage: number | null;
  /** Weapon only */
  cap_drain_kear: number | null;
  /** Weapon only */
  reload_speed_s: number | null;
  /** Weapon only */
  optimal_range: number | null;
  /** Weapon only */
  fall_off: number | null;
  /** cargoscanner/capdrainer/slicekit only — per-activation chance to not consume ammo/charge */
  use_no_ammo: number | null;
  /** Only set for the few triggered/on-cooldown non-weapon modules */
  cooldown_s: number | null;
  /** Non-weapon only — free-text effect description, e.g. "+10.00% capacitor hit points" */
  effect_bonus: string | null;
  price_marks: number;
  notes: string | null;
}

/**
 * "Damage Boost" is the only module (as of the current data snapshot) whose
 * bonus isn't passive — it only applies once linked to one specific fitted weapon
 * in-game via `SHIP MODULE LINK <#> TO <#>`. Matched on the "linked module" phrase
 * in its effect text rather than by name/id, so any future module with the same
 * link-to-activate semantics is picked up automatically.
 */
export function isDamageBoostModule(m: ShipModule): boolean {
  return m.effect_bonus?.includes('linked module') ?? false;
}

/**
 * Cargo Hold I/II/III grant a flat tons bonus ("100 extra cargo space"), unlike
 * every other modded stat in this app which is a percentage delta — parsed
 * generically off the "<N> extra cargo space" phrasing rather than hardcoded to
 * these three modules' names/ids, so any future module using the same wording is
 * picked up automatically. Returns 0 for modules with no such bonus.
 */
export function cargoCapacityBonusTons(m: ShipModule): number {
  const match = m.effect_bonus?.match(/^(\d+(?:\.\d+)?)\s+extra cargo space$/);
  return match ? Number(match[1]) : 0;
}
