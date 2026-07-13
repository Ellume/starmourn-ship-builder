import { Injectable, computed, signal } from '@angular/core';
import { FittedMod } from '../calc/mod-capacity';
import { ShipComponent } from '../models/component';
import { ShipModule, isDamageBoostModule } from '../models/module';
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

  /**
   * One entry per fitted Damage Boost module, in fit order — value is the linked
   * weapon's module `id`, or null if unlinked. Fitted Damage Boost modules are
   * otherwise indistinguishable from each other (duplicate fits are literally the
   * same `ShipModule` object reference, same as every other module), so a link is
   * tracked by ordinal position among Damage Boost fits rather than by instance
   * identity. `addModule`/`removeModule` keep this array's length in sync with the
   * fitted count; `removeModule` always drops index 0, matching its own "removes
   * the first instance found" semantics below.
   */
  readonly damageBoostLinks = signal<(number | null)[]>([]);

  /** Linked-boost count per weapon module id, ignoring links whose target weapon is no longer fitted. Feeds computeModdedStats. */
  readonly damageBoostCounts = computed(() => {
    const fittedWeaponIds = new Set(this.modules().filter((m) => m.weapon_module === 'Yes').map((m) => m.id));
    const counts = new Map<number, number>();
    for (const weaponId of this.damageBoostLinks()) {
      if (weaponId == null || !fittedWeaponIds.has(weaponId)) continue;
      counts.set(weaponId, (counts.get(weaponId) ?? 0) + 1);
    }
    return counts;
  });

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
    this.damageBoostLinks.set([]);
  }

  addModule(module: ShipModule): void {
    this.modules.update((mods) => [...mods, module]);
    if (isDamageBoostModule(module)) {
      this.damageBoostLinks.update((links) => [...links, null]);
    }
  }

  /** Removes one instance of `module` (by reference) — the same module can be fitted more than once. */
  removeModule(module: ShipModule): void {
    this.modules.update((mods) => {
      const index = mods.indexOf(module);
      return index === -1 ? mods : mods.filter((_, i) => i !== index);
    });
    if (isDamageBoostModule(module)) {
      this.damageBoostLinks.update((links) => links.slice(1));
    }
  }

  /** `index` is the ordinal position among fitted Damage Boost modules (see `damageBoostLinks`). */
  setDamageBoostLink(index: number, weaponModuleId: number | null): void {
    this.damageBoostLinks.update((links) => links.map((v, i) => (i === index ? weaponModuleId : v)));
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
