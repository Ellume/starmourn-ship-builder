import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ClassModSlots, ClassModSlotsRow, CARRIER_MOD_SLOTS_FALLBACK, parseClassModSlots } from '../models/class-mod-slots';
import { ComponentType, ShipComponent } from '../models/component';
import { ShipModule } from '../models/module';
import { ShipClass, ShipModel } from '../models/ship-model';
import { ShipModLevel, ShipModLevelRaw, ShipModSummary } from '../models/ship-mod';
import { validateParsing } from '../models/mod-effect-parser';

/**
 * Loads and indexes the static data/*.json snapshot (served from public/data/,
 * synced from the repo-root data/ folder — see scripts/sync-data.mjs).
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);

  readonly shipModels = signal<ShipModel[]>([]);
  readonly components = signal<ShipComponent[]>([]);
  readonly modules = signal<ShipModule[]>([]);
  readonly classModSlots = signal<ClassModSlots[]>([]);
  readonly shipMods = signal<ShipModSummary[]>([]);
  readonly shipModLevels = signal<ShipModLevel[]>([]);

  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  private loadPromise: Promise<void> | null = null;

  /** Idempotent — safe to call from multiple components, only fetches once. */
  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetchAll();
    }
    return this.loadPromise;
  }

  private async fetchAll(): Promise<void> {
    try {
      const [shipModels, components, modules, classModSlotsRows, shipMods, shipModLevelsRaw] = await Promise.all([
        firstValueFrom(this.http.get<ShipModel[]>('data/ship-models.json')),
        firstValueFrom(this.http.get<ShipComponent[]>('data/components.json')),
        firstValueFrom(this.http.get<ShipModule[]>('data/modules.json')),
        firstValueFrom(this.http.get<ClassModSlotsRow[]>('data/class-mod-slots.json')),
        firstValueFrom(this.http.get<ShipModSummary[]>('data/ship-mods.json')),
        firstValueFrom(this.http.get<ShipModLevelRaw[]>('data/ship-mod-levels.json')),
      ]);

      this.shipModels.set(shipModels);
      this.components.set(components);
      this.modules.set(modules);
      this.classModSlots.set([...parseClassModSlots(classModSlotsRows), CARRIER_MOD_SLOTS_FALLBACK]);
      this.shipMods.set(shipMods);

      const { parsed, issues } = validateParsing(shipModLevelsRaw);
      if (issues.length) {
        // Data-normalization issues should be caught by the mod-effect-parser unit
        // tests before this ever ships — surface loudly if one slips through.
        console.warn(`ship-mod-levels.json: ${issues.length} row(s) failed to parse`, issues);
      }
      this.shipModLevels.set(parsed);

      this.loaded.set(true);
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  componentsByType(type: ComponentType): ShipComponent[] {
    return this.components().filter((c) => c.type === type);
  }

  modelsByClass(shipClass: ShipClass): ShipModel[] {
    return this.shipModels().filter((m) => m.class === shipClass);
  }

  modSlotsForClass(shipClass: ShipClass): ClassModSlots {
    return this.classModSlots().find((c) => c.class === shipClass) ?? CARRIER_MOD_SLOTS_FALLBACK;
  }

  /** All 15 levels of one mod, sorted ascending. */
  modLevelsFor(shortname: string): ShipModLevel[] {
    return this.shipModLevels()
      .filter((m) => m.shortname === shortname)
      .sort((a, b) => a.level - b.level);
  }
}
