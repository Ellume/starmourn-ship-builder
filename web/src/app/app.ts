import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';

import { DataService } from './core/data/data.service';
import { ThemeService } from './core/theme/theme.service';
import { CommandOutput } from './features/command-output/command-output';
import { LoadoutEditor } from './features/loadout-editor/loadout-editor';
import { ShipPicker } from './features/ship-picker/ship-picker';
import { StatsPanel } from './features/stats-panel/stats-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToolbarModule, ButtonModule, ShipPicker, LoadoutEditor, StatsPanel, CommandOutput],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly data = inject(DataService);

  ngOnInit(): void {
    this.data.load();
  }
}
