import { Injectable, computed, signal } from '@angular/core';
import { FittedMod } from '../calc/mod-capacity';
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
  /** Crafted ship mods (data/ship-mods.json) — a separate 6-slot/60-level-budget system from `modules`. Not hull-specific, so not cleared on hull change. */
  readonly mods = signal<FittedMod[]>([]);

  readonly weaponModules = computed(() =>
    this.modules()
      .filter((m) => m.weapon_module === 'Yes')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly nonWeaponModules = computed(() =>
    this.modules()
      .filter((m) => m.weapon_module === 'No')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly hullClass = computed(() => this.hull()?.class ?? null);

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

  addMod(shortname: string): void {
    this.mods.update((mods) => [...mods, { shortname, level: 1 }]);
  }

  removeMod(shortname: string): void {
    this.mods.update((mods) => mods.filter((m) => m.shortname !== shortname));
  }

  setModLevel(shortname: string, level: number): void {
    this.mods.update((mods) => mods.map((m) => (m.shortname === shortname ? { ...m, level } : m)));
  }

  reset(): void {
    this.setHull(null);
    this.mods.set([]);
  }
}
