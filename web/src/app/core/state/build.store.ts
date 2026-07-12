import { Injectable, computed, signal } from '@angular/core';
import { ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipModel } from '../models/ship-model';

@Injectable({ providedIn: 'root' })
export class BuildStore {
  readonly hull = signal<ShipModel | null>(null);
  readonly capacitor = signal<ShipComponent | null>(null);
  readonly engine = signal<ShipComponent | null>(null);
  readonly shield = signal<ShipComponent | null>(null);
  readonly shipsim = signal<ShipComponent | null>(null);
  readonly sensor = signal<ShipComponent | null>(null);
  readonly modules = signal<ShipModule[]>([]);

  readonly weaponModules = computed(() => this.modules().filter((m) => m.weapon_module === 'Yes'));
  readonly nonWeaponModules = computed(() => this.modules().filter((m) => m.weapon_module === 'No'));

  /** Hull selection clears the fitted components/modules — the old catalog is class-restricted, a stale fit could be invalid on the new hull. */
  setHull(hull: ShipModel | null): void {
    this.hull.set(hull);
    this.capacitor.set(null);
    this.engine.set(null);
    this.shield.set(null);
    this.shipsim.set(null);
    this.sensor.set(null);
    this.modules.set([]);
  }

  addModule(module: ShipModule): void {
    this.modules.update((mods) => [...mods, module]);
  }

  /** Removes one instance of `module` (by reference) — the same module can be fitted more than once. */
  removeModule(module: ShipModule): void {
    this.modules.update((mods) => {
      const index = mods.indexOf(module);
      return index === -1 ? mods : mods.filter((_, i) => i !== index);
    });
  }

  reset(): void {
    this.setHull(null);
  }
}
