import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CardModule } from 'primeng/card';

import { ModContribution, ModEffectSource, ModdedBuildStats, StatBreakdown, computeModdedStats } from '../../core/calc/mod-effects';
import { DataService } from '../../core/data/data.service';
import { BuildStore } from '../../core/state/build.store';

/** A displayable stat row — `breakdown` is null when either the stat isn't
 * applicable (e.g. Capacitance with no capacitor fitted) or no fitted mod
 * touches it, so the row renders as a plain value with no extra lines. */
interface StatRow {
  label: string;
  value: number | null;
  format: string;
  unit: string;
  warn: boolean;
  breakdown: { base: number; contributions: ModContribution[] } | null;
}

@Component({
  selector: 'app-stats-panel',
  imports: [CardModule, DecimalPipe],
  templateUrl: './stats-panel.html',
  styleUrl: './stats-panel.scss',
})
export class StatsPanel {
  protected readonly build = inject(BuildStore);
  private readonly data = inject(DataService);

  private readonly modEffectSources = computed<ModEffectSource[]>(() =>
    this.build.mods().map((mod) => {
      const summary = this.data.shipMods().find((s) => s.shortname === mod.shortname);
      const level = this.data.modLevelsFor(mod.shortname)[mod.level - 1];
      return { modName: summary?.full_name ?? mod.shortname, level: mod.level, effects: level?.effects ?? [] };
    }),
  );

  protected readonly stats = computed<ModdedBuildStats | null>(() => {
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

  protected readonly overBudget = computed(() => {
    const s = this.stats();
    if (!s) return false;
    return s.power.remaining < 0 || s.cycles.remaining < 0;
  });

  /** Merged view of health.hull + health.shield — one row, like Mass merges its per-component breakdowns. */
  protected readonly healthBreakdown = computed(() => {
    const s = this.stats();
    if (!s) return null;
    return {
      base: s.health.hull.base + s.health.shield.base,
      contributions: [...s.health.hull.contributions, ...s.health.shield.contributions],
    };
  });

  protected readonly rows = computed<StatRow[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const hasCapacitor = this.build.capacitor() != null;
    const hasSensor = this.build.sensor() != null;
    const hasShield = this.build.shield() != null;
    const hasWeapons = this.build.weaponModules().length > 0;

    return [
      this.row('Alpha Strike', s.alphaStrike, '1.0-0', ''),
      this.row('DPS', s.dps, '1.2-2', ''),
      this.row('Weapon Kear Drain', hasWeapons ? s.totalCapDrainKear : null, '1.0-0', ' kear'),
      this.row('Mass', s.mass, '1.0-0', ' t'),
      this.row('Thrust / Mass', s.thrustOverMass, '1.3-3', ''),
      this.row('Turn Speed', s.turnSpeedSeconds, '1.2-2', 's'),
      this.row('Max Speed', s.maxSpeed, '1.0-0', ''),
      this.row('Time to Max Speed', s.timeToMaxSpeedSeconds, '1.0-0', 's'),
      this.row('Cargo Capacity', s.cargoCapacityTons, '1.0-0', ' t'),
      this.row('Capacitance', hasCapacitor ? s.capacitance : null, '1.0-0', ' kear'),
      this.row('Sensor Jam Strength', hasSensor ? s.sensorJamStrength : null, '1.0-0', ''),
      this.row('Shield Recharge', hasShield ? s.shieldRechargeSeconds : null, '1.0-0', 's'),
      this.row('Hull Thermal Res.', s.resistances.hullThermal, '1.1-2', '%'),
      this.row('Hull Kinetic Res.', s.resistances.hullKinetic, '1.1-2', '%'),
      this.row('Hull Gravitic Res.', s.resistances.hullGravitic, '1.1-2', '%'),
      this.row('Shield EM Res.', hasShield ? s.resistances.shieldEM : null, '1.1-2', '%'),
      this.row('Shield Kinetic Res.', hasShield ? s.resistances.shieldKinetic : null, '1.1-2', '%'),
      this.row('Shield Gravitic Res.', hasShield ? s.resistances.shieldGravitic : null, '1.1-2', '%'),
    ];
  });

  private row(label: string, breakdown: StatBreakdown | null, format: string, unit: string): StatRow {
    if (!breakdown) return { label, value: null, format, unit, warn: false, breakdown: null };
    return {
      label,
      value: breakdown.final,
      format,
      unit,
      warn: false,
      breakdown: breakdown.contributions.length ? { base: breakdown.base, contributions: breakdown.contributions } : null,
    };
  }

  protected contributionText(c: ModContribution): string {
    const sign = c.deltaPct >= 0 ? '+' : '';
    return `${c.modName} (Lv${c.level}) ${sign}${c.deltaPct.toFixed(2)}%`;
  }

  protected modNamesText(contributions: ModContribution[]): string {
    return contributions.map((c) => `${c.modName} (Lv${c.level})`).join(', ');
  }
}
