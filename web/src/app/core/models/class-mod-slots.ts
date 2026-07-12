import { ShipClass } from './ship-model';

/** Raw row shape as it appears in data/class-mod-slots.json (includes two trailing note/blank rows). */
export interface ClassModSlotsRow {
  class: string | null;
  small_mods: string | null;
  med_mods: string | null;
  large_mods: string | null;
}

export interface SlotRange {
  min: number;
  max: number;
}

/** Parsed per-class mod slot counts, e.g. "1-2" -> { min: 1, max: 2 }. */
export interface ClassModSlots {
  class: ShipClass;
  small_mods: SlotRange;
  med_mods: SlotRange;
  large_mods: SlotRange;
  /** True for classes absent from the source table (currently only Carrier) — counts are a placeholder, not confirmed data. */
  unconfirmed: boolean;
}

/** Carrier has 0 hardpoints/is mod-only but isn't in the 7-class source table — slot breakdown by size is unconfirmed. */
export const CARRIER_MOD_SLOTS_FALLBACK: ClassModSlots = {
  class: 'Carrier',
  small_mods: { min: 0, max: 0 },
  med_mods: { min: 0, max: 0 },
  large_mods: { min: 0, max: 0 },
  unconfirmed: true,
};

function parseRange(raw: string): SlotRange {
  const [min, max] = raw.split('-').map(Number);
  return max === undefined ? { min, max: min } : { min, max };
}

interface CompleteClassModSlotsRow {
  class: string;
  small_mods: string;
  med_mods: string;
  large_mods: string;
}

function isCompleteRow(row: ClassModSlotsRow): row is CompleteClassModSlotsRow {
  return Boolean(row.class && row.small_mods && row.med_mods && row.large_mods);
}

export function parseClassModSlots(rows: ClassModSlotsRow[]): ClassModSlots[] {
  return rows.filter(isCompleteRow).map((row) => ({
    class: row.class as ShipClass,
    small_mods: parseRange(row.small_mods),
    med_mods: parseRange(row.med_mods),
    large_mods: parseRange(row.large_mods),
    unconfirmed: false,
  }));
}
