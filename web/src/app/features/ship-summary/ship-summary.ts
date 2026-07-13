import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { MODULE_SIZE_POINTS } from '../../core/calc/capacity';
import { ModContribution, ModEffectSource, computeModdedStats } from '../../core/calc/mod-effects';
import { DataService } from '../../core/data/data.service';
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
  private readonly data = inject(DataService);

  private readonly modEffectSources = computed<ModEffectSource[]>(() =>
    this.build.mods().map((mod) => {
      const summary = this.data.shipMods().find((s) => s.shortname === mod.shortname);
      const level = this.data.modLevelsFor(mod.shortname)[mod.level - 1];
      return { modName: summary?.full_name ?? mod.shortname, level: mod.level, effects: level?.effects ?? [] };
    }),
  );

  protected readonly stats = computed(() => {
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

  protected readonly componentsMassTons = computed(() =>
    [this.build.capacitor(), this.build.engine(), this.build.shield(), this.build.shipsim(), this.build.sensor()]
      .filter((c): c is NonNullable<typeof c> => c != null)
      .reduce((sum, c) => sum + c.mass_tons, 0),
  );

  protected readonly hardpointsMax = computed(() => this.stats()?.hardpoints.max.final ?? 0);
  protected readonly hardpointsUsed = computed(() => this.stats()?.hardpoints.used ?? 0);
  protected readonly modCapMax = computed(() => this.stats()?.modCap.max.final ?? 0);
  protected readonly modCapUsed = computed(() => this.stats()?.modCap.used ?? 0);

  /** null when no fitted mod touches hardpoint/module capacity — same "only show if it applies" rule as the Stats panel's rows. */
  protected readonly hardpointsBreakdown = computed(() => {
    const max = this.stats()?.hardpoints.max;
    return max?.contributions.length ? max : null;
  });
  protected readonly modCapBreakdown = computed(() => {
    const max = this.stats()?.modCap.max;
    return max?.contributions.length ? max : null;
  });

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

  contributionText(c: ModContribution): string {
    const sign = c.deltaPct >= 0 ? '+' : '';
    return `${c.modName} (Lv${c.level}) ${sign}${c.deltaPct.toFixed(2)}%`;
  }
}
