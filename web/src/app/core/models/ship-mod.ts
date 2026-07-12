/** Crafted hull/component mod catalog entry (Level 1/15 endpoints only). Source: data/ship-mods.json */
export interface ShipModSummary {
  shortname: string;
  full_name: string;
  family: string;
  manufacturer: string;
  info: string;
  effect_level_1: string;
  effect_level_15: string;
  parts_level_1: string;
  parts_level_15: string;
  class_cost_multiplier_note: string;
  notes: string | null;
}

/** One mod at one specific level (1-15), raw free-text form. Source: data/ship-mod-levels.json */
export interface ShipModLevelRaw {
  shortname: string;
  full_name: string;
  level: number;
  parts_interceptor_base_cost: string;
  effect: string;
}

export type Material = 'Nanotubes' | 'Superalloys' | 'Aerogels' | 'Metamaterials' | 'Amorphites';

export interface PartCost {
  material: Material;
  qty: number;
}

/** A single parsed stat delta, e.g. { stat: 'hull kinetic resistance', delta_pct: 2.1 } */
export interface ModEffect {
  stat: string;
  delta_pct: number;
}

/** Fully parsed mod level: structured effects/parts derived from ShipModLevelRaw's free-text fields. */
export interface ShipModLevel {
  shortname: string;
  full_name: string;
  level: number;
  parts: PartCost[];
  effects: ModEffect[];
}

/** Per-class part-cost multiplier, applied to the Interceptor-baseline parts_interceptor_base_cost. Same for every mod. */
export const MOD_CLASS_COST_MULTIPLIER: Record<string, number> = {
  Interceptor: 1.0,
  Corvette: 1.25,
  Destroyer: 1.5,
  Cruiser: 1.75,
  Battleship: 2.0,
  Freighter: 1.6,
  Superhauler: 1.8,
  Carrier: 2.2,
};
