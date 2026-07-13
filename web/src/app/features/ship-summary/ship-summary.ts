import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { MODULE_SIZE_POINTS, hardpointPointsUsed, modCapPointsUsed } from '../../core/calc/capacity';
import { calculateBuildStats } from '../../core/calc/stats-engine';
import { ShipModule } from '../../core/models/module';
import { BuildStore } from '../../core/state/build.store';
import { StatsPanel } from '../stats-panel/stats-panel';

interface SizeBreakdown {
  small: number;
  medium: number;
  large: number;
}

interface PowerLine {
  label: string;
  halons: number;
  pctOfMax: number;
}

/**
 * Read-only "everything about this ship" view, modeled on the game's `SF DETAILS`
 * printout: full per-component stat blocks, hardpoint/module size breakdown, and a
 * power/cycles breakdown per fitted item — not just the compact Stats card. Cargo/
 * tonnage tracking from the in-game printout is intentionally omitted: this app has
 * no concept of loaded cargo, only the hull's static `capacity_tons` figure.
 */
@Component({
  selector: 'app-ship-summary',
  imports: [DecimalPipe, StatsPanel],
  templateUrl: './ship-summary.html',
  styleUrl: './ship-summary.scss',
})
export class ShipSummary {
  protected readonly build = inject(BuildStore);

  protected readonly stats = computed(() => {
    const hull = this.build.hull();
    if (!hull) return null;
    return calculateBuildStats({
      hull,
      capacitor: this.build.capacitor() ?? undefined,
      engine: this.build.engine() ?? undefined,
      shield: this.build.shield() ?? undefined,
      shipsim: this.build.shipsim() ?? undefined,
      sensor: this.build.sensor() ?? undefined,
      modules: this.build.modules(),
    });
  });

  protected readonly componentsMassTons = computed(() =>
    [this.build.capacitor(), this.build.engine(), this.build.shield(), this.build.shipsim(), this.build.sensor()]
      .filter((c): c is NonNullable<typeof c> => c != null)
      .reduce((sum, c) => sum + c.mass_tons, 0),
  );

  protected readonly hardpointsMax = computed(() => this.build.hull()?.hardpoints ?? 0);
  protected readonly hardpointsUsed = computed(() => hardpointPointsUsed(this.build.modules()));
  protected readonly modCapMax = computed(() => this.build.hull()?.mod_cap ?? 0);
  protected readonly modCapUsed = computed(() => modCapPointsUsed(this.build.modules()));

  protected readonly weaponSizeBreakdown = computed(() => this.sizeBreakdown(this.build.weaponModules()));
  protected readonly moduleSizeBreakdown = computed(() => this.sizeBreakdown(this.build.nonWeaponModules()));

  protected readonly powerBreakdown = computed<PowerLine[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const lines: PowerLine[] = [
      { label: 'Capacitor', halons: this.build.capacitor()?.power_need_halons ?? 0, pctOfMax: 0 },
      { label: 'Engine', halons: this.build.engine()?.power_need_halons ?? 0, pctOfMax: 0 },
      { label: 'Sensor', halons: this.build.sensor()?.power_need_halons ?? 0, pctOfMax: 0 },
      { label: 'Shield', halons: this.build.shield()?.power_need_halons ?? 0, pctOfMax: 0 },
      { label: 'Shipsim', halons: this.build.shipsim()?.power_need_halons ?? 0, pctOfMax: 0 },
    ];
    return lines.map((l) => ({ ...l, pctOfMax: s.power.max ? (l.halons / s.power.max) * 100 : 0 }));
  });

  protected readonly moduleName = (m: ShipModule) => `${m.id}) ${m.name}`;

  private sizeBreakdown(modules: ShipModule[]): SizeBreakdown {
    return modules.reduce(
      (acc, m) => {
        acc[m.size]++;
        return acc;
      },
      { small: 0, medium: 0, large: 0 },
    );
  }

  pointsFor(module: ShipModule): number {
    return MODULE_SIZE_POINTS[module.size];
  }
}
