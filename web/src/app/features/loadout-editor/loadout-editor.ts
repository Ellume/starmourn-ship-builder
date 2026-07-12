import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { MODULE_SIZE_POINTS, hardpointPointsUsed, modCapPointsUsed } from '../../core/calc/capacity';
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

  private readonly hullClass = computed(() => this.build.hull()?.class ?? null);

  protected readonly capacitors = computed<ShipComponent[]>(() => this.componentsFor('Capacitor'));
  protected readonly engines = computed<ShipComponent[]>(() => this.componentsFor('Engine'));
  protected readonly shields = computed<ShipComponent[]>(() => this.componentsFor('Shield'));
  protected readonly shipsims = computed<ShipComponent[]>(() => this.componentsFor('Shipsim'));
  protected readonly sensors = computed<ShipComponent[]>(() => this.componentsFor('Sensor'));

  protected readonly weaponOptions = computed<ShipModule[]>(() => this.data.modules().filter((m) => m.weapon_module === 'Yes'));
  protected readonly nonWeaponOptions = computed<ShipModule[]>(() => this.data.modules().filter((m) => m.weapon_module === 'No'));

  protected readonly pendingWeapon = signal<ShipModule | null>(null);
  protected readonly pendingModule = signal<ShipModule | null>(null);

  protected readonly hardpointsMax = computed(() => this.build.hull()?.hardpoints ?? 0);
  protected readonly hardpointsUsed = computed(() => hardpointPointsUsed(this.build.modules()));
  protected readonly modCapMax = computed(() => this.build.hull()?.mod_cap ?? 0);
  protected readonly modCapUsed = computed(() => modCapPointsUsed(this.build.modules()));

  private componentsFor(type: ShipComponent['type']): ShipComponent[] {
    const shipClass = this.hullClass();
    return shipClass ? this.data.componentsByType(type).filter((c) => c.class === shipClass) : [];
  }

  addWeapon(module: ShipModule | null): void {
    if (!module) return;
    if (this.hardpointsUsed() + MODULE_SIZE_POINTS[module.size] > this.hardpointsMax()) return;
    this.build.addModule(module);
    this.pendingWeapon.set(null);
  }

  addModule(module: ShipModule | null): void {
    if (!module) return;
    if (this.modCapUsed() + MODULE_SIZE_POINTS[module.size] > this.modCapMax()) return;
    this.build.addModule(module);
    this.pendingModule.set(null);
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
