import { Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { BuildStore } from '../../core/state/build.store';

/**
 * In-game command sequence to reproduce the current build. Confirmed live
 * against the old site: "SF MODEL <id>", "SF INSTALL <TYPE> <id>" for the 5
 * fitted components, and — resolving a gap noted in data/ship-purchases-notes.md
 * ("module install command wasn't captured") — "SF INSTALL MODULE <id>" for
 * both weapon and non-weapon modules alike.
 */
@Component({
  selector: 'app-command-output',
  imports: [ButtonModule],
  templateUrl: './command-output.html',
  styleUrl: './command-output.scss',
})
export class CommandOutput {
  protected readonly build = inject(BuildStore);

  protected readonly commands = computed<string[]>(() => {
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

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.commands().join('\n'));
  }
}
