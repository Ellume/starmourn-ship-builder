import { Component, WritableSignal, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Select, SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { MODULE_SIZE_POINTS } from '../../core/calc/capacity';
import { ModEffectSource, computeModdedStats } from '../../core/calc/mod-effects';
import { DataService } from '../../core/data/data.service';
import { ShipComponent } from '../../core/models/component';
import { ShipModule } from '../../core/models/module';
import { BuildStore } from '../../core/state/build.store';

@Component({
  selector: 'app-loadout-editor',
  imports: [SelectModule, FormsModule, ButtonModule, TagModule],
  templateUrl: './loadout-editor.html',
  styleUrl: './loadout-editor.scss',
})
export class LoadoutEditor {
  private readonly data = inject(DataService);
  protected readonly build = inject(BuildStore);

  protected readonly capacitors = computed<ShipComponent[]>(() => this.componentsFor('Capacitor'));
  protected readonly engines = computed<ShipComponent[]>(() => this.componentsFor('Engine'));
  protected readonly shields = computed<ShipComponent[]>(() => this.componentsFor('Shield'));
  protected readonly shipsims = computed<ShipComponent[]>(() => this.componentsFor('Shipsim'));
  protected readonly sensors = computed<ShipComponent[]>(() => this.componentsFor('Sensor'));

  private readonly modulesForHull = computed<ShipModule[]>(() => {
    const shipClass = this.build.hullClass();
    return shipClass ? this.data.modulesByClass(shipClass) : [];
  });

  protected readonly weaponOptions = computed<ShipModule[]>(() =>
    this.modulesForHull()
      .filter((m) => m.weapon_module === 'Yes')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly nonWeaponOptions = computed<ShipModule[]>(() =>
    this.modulesForHull()
      .filter((m) => m.weapon_module === 'No')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly pendingWeapon = signal<ShipModule | null>(null);
  protected readonly pendingModule = signal<ShipModule | null>(null);

  /**
   * PrimeNG's Select.onOptionSelect only re-fires a selection when the clicked option
   * differs from its OWN internal `modelValue`. Its `updateModel()` unconditionally
   * re-stamps `modelValue` to the just-picked value as its *last* synchronous step —
   * after our (ngModelChange) handler has already run — so resetting synchronously
   * inside addWeapon/addModule (via the bound signal or even a direct `writeValue`
   * call) gets clobbered by that same still-in-progress call. The reset has to happen
   * on a later task, once PrimeNG's own onOptionSelect call stack has fully unwound,
   * or re-picking the same item twice in a row silently no-ops.
   */
  private readonly weaponSelect = viewChild<Select>('weaponSelect');
  private readonly moduleSelect = viewChild<Select>('moduleSelect');

  private readonly modEffectSources = computed<ModEffectSource[]>(() =>
    this.build.mods().map((mod) => {
      const summary = this.data.shipMods().find((s) => s.shortname === mod.shortname);
      const level = this.data.modLevelsFor(mod.shortname)[mod.level - 1];
      return { modName: summary?.full_name ?? mod.shortname, level: mod.level, effects: level?.effects ?? [] };
    }),
  );

  /** Reuses stats-engine/mod-effects so these numbers never drift from the Stats panel. */
  private readonly stats = computed(() => {
    const hull = this.build.hull();
    if (!hull) return null;
    return computeModdedStats(
      {
        hull,
        capacitor: this.build.capacitor() ?? undefined,
        engine: this.build.engine() ?? undefined,
        shield: this.build.shield() ?? undefined,
        shipsim: this.build.shipsim() ?? undefined,
        sensor: this.build.sensor() ?? undefined,
        modules: this.build.modules(),
      },
      this.modEffectSources(),
    );
  });
  protected readonly powerUsed = computed(() => this.stats()?.power.used.final ?? 0);
  protected readonly powerMax = computed(() => this.stats()?.power.max ?? 0);
  protected readonly cyclesUsed = computed(() => this.stats()?.cycles.used ?? 0);
  protected readonly cyclesMax = computed(() => this.stats()?.cycles.max.final ?? 0);
  protected readonly hardpointsUsed = computed(() => this.stats()?.hardpoints.used ?? 0);
  protected readonly hardpointsMax = computed(() => this.stats()?.hardpoints.max.final ?? 0);
  protected readonly modCapUsed = computed(() => this.stats()?.modCap.used ?? 0);
  protected readonly modCapMax = computed(() => this.stats()?.modCap.max.final ?? 0);

  private componentsFor(type: ShipComponent['type']): ShipComponent[] {
    const shipClass = this.build.hullClass();
    return shipClass ? this.data.componentsByType(type).filter((c) => c.class === shipClass) : [];
  }

  /**
   * Hardpoint/module capacity is a warn-only budget, like Power/Cycles (see
   * stats-panel's overBudget) — a ship mod can raise or lower it, so blocking the
   * add outright would leave no way to recover from "fit a capacity mod, add
   * weapons with the new room, then remove the mod" without going negative first.
   * The Weapons/Modules headers in the template turn red instead when over.
   */
  addWeapon(module: ShipModule | null): void {
    if (module) this.build.addModule(module);
    this.resetSelectAfterPick(this.pendingWeapon, this.weaponSelect());
  }

  addModule(module: ShipModule | null): void {
    if (module) this.build.addModule(module);
    this.resetSelectAfterPick(this.pendingModule, this.moduleSelect());
  }

  private resetSelectAfterPick(pending: WritableSignal<ShipModule | null>, select: Select | undefined): void {
    setTimeout(() => {
      pending.set(null);
      select?.writeValue(null);
    });
  }

  remove(module: ShipModule): void {
    this.build.removeModule(module);
  }

  pointsFor(module: ShipModule): number {
    return MODULE_SIZE_POINTS[module.size];
  }

  /** Weapon-only stat line — damage/fire-reload/range are only meaningful on weapon modules. */
  weaponDetails(m: ShipModule): string {
    const parts = [
      `${m.weapon_damage} dmg`,
      `${m.firing_speed_s}s fire / ${m.reload_speed_s}s reload`,
      `${m.cap_drain_kear} kear/shot`,
      `range ${m.optimal_range} (falloff ${m.fall_off})`,
    ];
    if (m.use_no_ammo != null) parts.push(`${m.use_no_ammo}% no-ammo chance`);
    return parts.join(' · ');
  }

  /** Non-weapon modules carry their effect as free text, plus an optional cooldown for the few triggered ones. */
  moduleDetails(m: ShipModule): string {
    const parts: string[] = [];
    if (m.effect_bonus) parts.push(m.effect_bonus);
    if (m.cooldown_s != null) parts.push(`${m.cooldown_s}s cooldown`);
    return parts.join(' · ');
  }

  resourceLine(m: ShipModule): string {
    return `${m.power_use_halons} halons · ${m.shipsim_cycles} cycles`;
  }

  componentLabel(c: ShipComponent): string {
    const keyStat =
      c.type === 'Capacitor'
        ? `${c.capacity_kear} kear`
        : c.type === 'Engine'
          ? `${c.thrust_halons}h thrust`
          : c.type === 'Sensor'
            ? `${c.sensor_strength} strength`
            : c.type === 'Shield'
              ? `${c.shield_strength_dam}@${c.recharge_s}s`
              : `${c.max_cycles} cycles`;
    return `${c.make} ${c.model} · ${keyStat} · ${c.mass_tons}t/${c.power_need_halons}h`;
  }
}
