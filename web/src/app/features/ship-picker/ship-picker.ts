import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { DataService } from '../../core/data/data.service';
import { BuildStore } from '../../core/state/build.store';
import { ShipClass, ShipModel } from '../../core/models/ship-model';

const SHIP_CLASSES: ShipClass[] = [
  'Interceptor',
  'Corvette',
  'Destroyer',
  'Cruiser',
  'Battleship',
  'Freighter',
  'Superhauler',
  'Carrier',
];

@Component({
  selector: 'app-ship-picker',
  imports: [SelectModule, FormsModule],
  templateUrl: './ship-picker.html',
  styleUrl: './ship-picker.scss',
})
export class ShipPicker implements OnInit {
  private readonly data = inject(DataService);
  protected readonly build = inject(BuildStore);

  protected readonly classes = SHIP_CLASSES;
  protected readonly selectedClass = signal<ShipClass>('Interceptor');
  protected readonly modelsForClass = computed<ShipModel[]>(() => this.data.modelsByClass(this.selectedClass()));

  ngOnInit(): void {
    this.data.load().then(() => {
      const models = this.modelsForClass();
      if (models.length) this.build.setHull(models[0]);
    });
  }

  onClassChange(shipClass: ShipClass): void {
    this.selectedClass.set(shipClass);
    const models = this.data.modelsByClass(shipClass);
    this.build.setHull(models[0] ?? null);
  }

  onModelChange(model: ShipModel | null): void {
    this.build.setHull(model);
  }
}
