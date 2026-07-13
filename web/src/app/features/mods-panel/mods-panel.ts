import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { TagModule } from 'primeng/tag';

import {
  FittedMod,
  MOD_LEVEL_BUDGET,
  MOD_SLOT_MAX,
  canAddMod,
  canRemoveMod,
  maxLevelFor,
  modLevelSum,
} from '../../core/calc/mod-capacity';
import { DataService } from '../../core/data/data.service';
import { MOD_CLASS_COST_MULTIPLIER, ModEffect, PartCost, ShipModSummary } from '../../core/models/ship-mod';
import { BuildStore } from '../../core/state/build.store';

interface FittedModRow {
  mod: FittedMod;
  summary: ShipModSummary;
  parts: PartCost[];
  effects: ModEffect[];
}

@Component({
  selector: 'app-mods-panel',
  imports: [SelectModule, SliderModule, FormsModule, ButtonModule, TagModule, MessageModule],
  templateUrl: './mods-panel.html',
  styleUrl: './mods-panel.scss',
})
export class ModsPanel {
  private readonly data = inject(DataService);
  protected readonly build = inject(BuildStore);

  protected readonly slotMax = MOD_SLOT_MAX;
  protected readonly levelBudget = MOD_LEVEL_BUDGET;

  private readonly costMultiplier = computed(() => {
    const shipClass = this.build.hullClass();
    return shipClass ? MOD_CLASS_COST_MULTIPLIER[shipClass] : 1;
  });

  protected readonly slotsUsed = computed(() => this.build.mods().length);
  protected readonly levelsUsed = computed(() => modLevelSum(this.build.mods()));

  protected readonly availableMods = computed<ShipModSummary[]>(() => {
    const installed = new Set(this.build.mods().map((m) => m.shortname));
    return this.data
      .shipMods()
      .filter((m) => !installed.has(m.shortname))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  });

  protected readonly fittedRows = computed<FittedModRow[]>(() =>
    this.build
      .mods()
      .map((mod) => {
        const summary = this.data.shipMods().find((s) => s.shortname === mod.shortname)!;
        const levels = this.data.modLevelsFor(mod.shortname);
        const atLevel = levels[mod.level - 1];
        const multiplier = this.costMultiplier();
        const parts = (atLevel?.parts ?? []).map((p) => ({ ...p, qty: Math.round(p.qty * multiplier) }));
        return { mod, summary, parts, effects: atLevel?.effects ?? [] };
      })
      .sort((a, b) => a.summary.full_name.localeCompare(b.summary.full_name)),
  );

  protected readonly pendingMod = signal<ShipModSummary | null>(null);
  protected readonly addError = signal<string | null>(null);

  addMod(summary: ShipModSummary | null): void {
    this.pendingMod.set(null);
    if (!summary) return;
    const check = canAddMod(summary.shortname, this.build.mods(), this.build.modules().length > 0);
    if (!check.ok) {
      this.addError.set(check.reason ?? 'Cannot add this mod.');
      return;
    }
    this.addError.set(null);
    this.build.addMod(summary.shortname);
  }

  removeMod(shortname: string): void {
    const check = canRemoveMod(shortname, this.build.modules().length > 0);
    if (!check.ok) {
      this.addError.set(check.reason ?? 'Cannot remove this mod.');
      return;
    }
    this.build.removeMod(shortname);
    this.addError.set(null);
  }

  maxLevel(shortname: string): number {
    return maxLevelFor(shortname, this.build.mods());
  }

  setLevel(shortname: string, level: number): void {
    const clamped = Math.min(Math.max(1, level), this.maxLevel(shortname));
    this.build.setModLevel(shortname, clamped);
  }

  effectText(effect: ModEffect): string {
    const sign = effect.delta_pct >= 0 ? '+' : '';
    return `${sign}${effect.delta_pct.toFixed(2)}% ${effect.stat}`;
  }

  partsText(parts: PartCost[]): string {
    return parts.map((p) => `${p.qty} ${p.material}`).join(', ');
  }
}
