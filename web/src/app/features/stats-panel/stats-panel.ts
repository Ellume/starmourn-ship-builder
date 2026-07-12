import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CardModule } from 'primeng/card';

import { BuildStats, calculateBuildStats } from '../../core/calc/stats-engine';
import { BuildStore } from '../../core/state/build.store';

@Component({
  selector: 'app-stats-panel',
  imports: [CardModule, DecimalPipe],
  templateUrl: './stats-panel.html',
  styleUrl: './stats-panel.scss',
})
export class StatsPanel {
  protected readonly build = inject(BuildStore);

  protected readonly stats = computed<BuildStats | null>(() => {
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

  protected readonly overBudget = computed(() => {
    const s = this.stats();
    if (!s) return false;
    return s.power.remaining < 0 || s.cycles.remaining < 0;
  });
}
