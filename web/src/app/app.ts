import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

import { DataService } from './core/data/data.service';
import { buildShareUrl } from './core/state/build-link';
import { BuildStore } from './core/state/build.store';
import { ThemeService } from './core/theme/theme.service';
import { LoadoutEditor } from './features/loadout-editor/loadout-editor';
import { ModsPanel } from './features/mods-panel/mods-panel';
import { ShipPicker } from './features/ship-picker/ship-picker';
import { ShipSummary } from './features/ship-summary/ship-summary';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToolbarModule,
    ButtonModule,
    DrawerModule,
    DialogModule,
    TooltipModule,
    ShipPicker,
    LoadoutEditor,
    ModsPanel,
    ShipSummary,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly data = inject(DataService);
  private readonly build = inject(BuildStore);

  protected readonly summaryOpen = signal(false);
  protected readonly commandsDialogOpen = signal(false);
  protected readonly copiedSection = signal<{ section: 'hull' | 'mods'; ok: boolean } | null>(null);
  protected readonly shareLinkStatus = signal<'copied' | 'failed' | null>(null);

  /**
   * In-game command sequence to reproduce the current build's hull and components.
   * Confirmed live against the old site: "SF MODEL <id>", "SF INSTALL <TYPE> <id>"
   * for the 5 fitted components, and — resolving a gap noted in
   * data/ship-purchases-notes.md ("module install command wasn't captured") —
   * "SF INSTALL MODULE <id>" for both weapon and non-weapon modules alike.
   */
  protected readonly hullCommands = computed<string[]>(() => {
    const hull = this.build.hull();
    if (!hull) return [];

    const lines = [`SF MODEL ${hull.id}`];
    if (this.build.capacitor()) lines.push(`SF INSTALL CAPACITOR ${this.build.capacitor()!.id}`);
    if (this.build.engine()) lines.push(`SF INSTALL ENGINE ${this.build.engine()!.id}`);
    if (this.build.shield()) lines.push(`SF INSTALL SHIELD ${this.build.shield()!.id}`);
    if (this.build.shipsim()) lines.push(`SF INSTALL SHIPSIM ${this.build.shipsim()!.id}`);
    if (this.build.sensor()) lines.push(`SF INSTALL SENSOR ${this.build.sensor()!.id}`);
    for (const module of this.build.modules()) {
      lines.push(`SF INSTALL MODULE ${module.id}`);
    }
    return lines;
  });

  /**
   * In-game command sequence for fitted ship mods, kept separate from hullCommands
   * since mods are crafted/installed independently of the hull (see
   * data/ship-mods-notes.md). Syntax confirmed live against the old site:
   * "MOD INSTALL <shortname> INTO SHIP AT LEVEL <level>", one line per fitted mod.
   */
  protected readonly modCommands = computed<string[]>(() =>
    this.build.mods().map((mod) => `MOD INSTALL ${mod.shortname} INTO SHIP AT LEVEL ${mod.level}`),
  );

  ngOnInit(): void {
    this.data.load();
  }

  protected sectionStatus(section: 'hull' | 'mods'): 'copied' | 'failed' | null {
    const current = this.copiedSection();
    if (!current || current.section !== section) return null;
    return current.ok ? 'copied' : 'failed';
  }

  protected copyIcon(status: 'copied' | 'failed' | null, defaultIcon: string): string {
    if (status === 'copied') return 'pi pi-check';
    if (status === 'failed') return 'pi pi-exclamation-triangle';
    return defaultIcon;
  }

  protected copyLabel(status: 'copied' | 'failed' | null, defaultLabel: string): string {
    if (status === 'copied') return 'Copied';
    if (status === 'failed') return 'Copy failed';
    return defaultLabel;
  }

  /** Writes to the clipboard and reports success/failure via `onResult` — a rejected
   * write (e.g. Safari's clipboard restrictions, an insecure/http origin, a permission-
   * denied iframe) should still surface *something* to the user rather than a click
   * that silently does nothing. */
  private writeToClipboard(text: string, onResult: (ok: boolean) => void): void {
    navigator.clipboard.writeText(text).then(
      () => onResult(true),
      () => onResult(false),
    );
  }

  copySection(section: 'hull' | 'mods'): void {
    const lines = section === 'hull' ? this.hullCommands() : this.modCommands();
    this.writeToClipboard(lines.join('\n'), (ok) => {
      this.copiedSection.set({ section, ok });
      setTimeout(() => {
        if (this.copiedSection()?.section === section) this.copiedSection.set(null);
      }, 1500);
    });
  }

  copyShareLink(): void {
    this.writeToClipboard(buildShareUrl(this.build, this.data), (ok) => {
      this.shareLinkStatus.set(ok ? 'copied' : 'failed');
      setTimeout(() => this.shareLinkStatus.set(null), 1500);
    });
  }
}
