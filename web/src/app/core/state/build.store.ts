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
  /**
   * Parallel to `modules` (kept in sync by addModule/removeModule) — whether each
   * fitted instance is powered on. A disabled weapon/module still occupies its
   * slot and costs shipsim cycles, but draws no power and (for weapons) deals no
   * damage — lets the user test a build with something switched off without unfitting it.
   */
  readonly moduleActive = signal<boolean[]>([]);
  /** Crafted ship mods (data/ship-mods.json) — a separate 6-slot/60-level-budget system from `modules`. Not hull-specific, so not cleared on hull change. */
  readonly mods = signal<FittedMod[]>([]);

  /**
   * One entry per fitted Damage Boost module, in fit order — value is the linked
   * weapon's module `id`, or null if unlinked. Duplicate Damage Boost fits are the
   * same `ShipModule` reference, so a link is tracked by ordinal position among
   * fits rather than by instance identity; `removeModule` always drops index 0,
   * matching its own "removes the first instance found" semantics below.
   */
  readonly damageBoostLinks = signal<(number | null)[]>([]);

  /**
   * Linked-boost count per weapon module id, ignoring links whose target weapon is
   * no longer fitted or whose own Damage Boost module is switched off. Feeds
   * computeModdedStats. `boostModuleIndices` maps each link's ordinal back to its
   * position in `modules`/`moduleActive` to check whether it's active.
   */
  readonly damageBoostCounts = computed(() => {
    const modules = this.modules();
    const active = this.moduleActive();
    const fittedWeaponIds = new Set(modules.filter((m) => m.weapon_module === 'Yes').map((m) => m.id));
    const boostModuleIndices = modules.reduce<number[]>((acc, m, i) => {
      if (isDamageBoostModule(m)) acc.push(i);
      return acc;
    }, []);
    const counts = new Map<number, number>();
    this.damageBoostLinks().forEach((weaponId, ordinal) => {
      if (weaponId == null || !fittedWeaponIds.has(weaponId)) return;
      const moduleIndex = boostModuleIndices[ordinal];
      const isActive = moduleIndex != null ? (active[moduleIndex] ?? true) : true;
      if (!isActive) return;
      counts.set(weaponId, (counts.get(weaponId) ?? 0) + 1);
    });
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
    this.moduleActive.set([]);
    this.damageBoostLinks.set([]);
  }

  addModule(module: ShipModule): void {
    this.modules.update((mods) => [...mods, module]);
    this.moduleActive.update((active) => [...active, true]);
    if (isDamageBoostModule(module)) {
      this.damageBoostLinks.update((links) => [...links, null]);
    }
  }

  /** Removes one instance of `module` (by reference) — the same module can be fitted more than once. */
  removeModule(module: ShipModule): void {
    const index = this.modules().indexOf(module);
    if (index === -1) return;
    this.modules.update((mods) => mods.filter((_, i) => i !== index));
    this.moduleActive.update((active) => active.filter((_, i) => i !== index));
    if (isDamageBoostModule(module)) {
      this.damageBoostLinks.update((links) => links.slice(1));
    }
  }

  /** `index` is the position in `modules` (and `moduleActive`) — see loadout-editor.ts's row computeds. */
  setModuleActive(index: number, active: boolean): void {
    this.moduleActive.update((arr) => arr.map((v, i) => (i === index ? active : v)));
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
