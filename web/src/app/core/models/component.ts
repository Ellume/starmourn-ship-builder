import { ShipClass } from './ship-model';

export type ComponentType = 'Capacitor' | 'Engine' | 'Sensor' | 'Shield' | 'Shipsim';

/**
 * A fitted component (one of the 5 types). All 5 types share this field set —
 * type-specific stats are null where they don't apply. Source: data/components.json
 */
export interface ShipComponent {
  type: ComponentType;
  id: number;
  make: string;
  model: string;
  class: ShipClass;
  mass_tons: number;
  power_need_halons: number;
  /** Capacitor only */
  capacity_kear: number | null;
  /** Engine only */
  thrust_halons: number | null;
  /** Sensor only */
  sensor_strength: number | null;
  /** Shield only */
  shield_strength_dam: number | null;
  /** Capacitor/Engine/Sensor/Shipsim — Shield has no HP (it has shield_strength_dam instead) */
  hp: number | null;
  /** Sensor only */
  jam_str: number | null;
  /** Shield only */
  recharge_s: number | null;
  /** Shield only */
  grav_res: number | null;
  /** Shield only */
  kin_res: number | null;
  /** Shield only */
  em_res: number | null;
  /** Shield only */
  antipierce: number | null;
  /** Shipsim only */
  max_cycles: number | null;
  price_marks: number;
  notes: string | null;
}
