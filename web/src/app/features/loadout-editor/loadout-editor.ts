import { Component, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { MODULE_SIZE_POINTS, hardpointPointsUsed, modCapPointsUsed } from '../../core/calc/capacity';
import { DataService } from '../../core/data/data.service';
import { ShipComponent } from '../../core/models/component';
import { ShipModule } from '../../core/models/module';
import { BuildStore } from '../../core/state/build.store';

@Component({
  selector: 'app-loadout-editor',
  imports: [SelectModule, FormsModule, ButtonModule, TagModule, MessageModule],
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

  protected readonly weaponOptions = computed<ShipModule[]>(() => this.modulesForHull().filter((m) => m.weapon_module === 'Yes'));
  protected readonly nonWeaponOptions = computed<ShipModule[]>(() => this.modulesForHull().filter((m) => m.weapon_module === 'No'));

  protected readonly pendingWeapon = signal<ShipModule | null>(null);
  protected readonly pendingModule = signal<ShipModule | null>(null);
  protected readonly weaponError = signal<string | null>(null);
  protected readonly moduleError = signal<string | null>(null);

  protected readonly hardpointsMax = computed(() => this.build.hull()?.hardpoints ?? 0);
  protected readonly hardpointsUsed = computed(() => hardpointPointsUsed(this.build.modules()));
  protected readonly modCapMax = computed(() => this.build.hull()?.mod_cap ?? 0);
  protected readonly modCapUsed = computed(() => modCapPointsUsed(this.build.modules()));
  protected readonly cyclesMax = computed(() => this.build.shipsim()?.max_cycles ?? 0);
  protected readonly cyclesUsed = computed(() =>
    this.build.modules().reduce((sum, m) => sum + m.shipsim_cycles, 0),
  );

  constructor() {
    // A hull swap invalidates stale capacity errors from the previous hull's budget —
    // key off the hull object itself (not just its class), since two hulls of the same
    // class can still have different hardpoint/mod_cap capacity.
    effect(() => {
      this.build.hull();
      this.weaponError.set(null);
      this.moduleError.set(null);
    });
  }

  private componentsFor(type: ShipComponent['type']): ShipComponent[] {
    const shipClass = this.build.hullClass();
    return shipClass ? this.data.componentsByType(type).filter((c) => c.class === shipClass) : [];
  }

  addWeapon(module: ShipModule | null): void {
    this.pendingWeapon.set(null);
    this.tryAddModule(module, this.hardpointsUsed(), this.hardpointsMax(), 'hardpoint capacity', this.weaponError);
  }

  addModule(module: ShipModule | null): void {
    this.pendingModule.set(null);
    this.tryAddModule(module, this.modCapUsed(), this.modCapMax(), 'module capacity', this.moduleError);
  }

  private tryAddModule(
    module: ShipModule | null,
    used: number,
    max: number,
    capacityLabel: string,
    errorSignal: WritableSignal<string | null>,
  ): void {
    if (!module) return;
    const needed = MODULE_SIZE_POINTS[module.size];
    if (used + needed > max) {
      errorSignal.set(`Not enough ${capacityLabel} for ${module.name} (needs ${needed}pt, ${max - used}pt free).`);
      return;
    }
    errorSignal.set(null);
    this.build.addModule(module);
  }

  remove(module: ShipModule): void {
    this.build.removeModule(module);
  }

  pointsFor(module: ShipModule): number {
    return MODULE_SIZE_POINTS[module.size];
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
    return `${c.make} ${c.model} — ${keyStat} — ${c.mass_tons}t/${c.power_need_halons}h`;
  }
}
