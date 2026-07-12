export type ShipClass =
  | 'Interceptor'
  | 'Corvette'
  | 'Destroyer'
  | 'Cruiser'
  | 'Battleship'
  | 'Freighter'
  | 'Superhauler'
  | 'Carrier';

/** A superstructure (hull) buyable at any station shipyard. Source: data/ship-models.json */
export interface ShipModel {
  id: number;
  make: string;
  model: string;
  class: ShipClass;
  size: number;
  mass_tons: number;
  strength_dam: number;
  turn_time_s: number;
  capacity_tons: number;
  power_halons: number;
  refit_cap: number;
  hardpoints: number;
  mod_cap: number;
  therm_res: number;
  kin_res: number;
  grav_res: number;
  price_marks: number;
  notes: string | null;
}
