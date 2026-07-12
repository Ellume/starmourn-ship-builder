import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'starmourn-ship-builder:theme';
const DARK_CLASS = 'app-dark';

export type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readStoredMode() ?? 'dark');

  constructor() {
    this.applyMode(this.mode());
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.applyMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  private applyMode(mode: ThemeMode): void {
    document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
  }

  private readStoredMode(): ThemeMode | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  }
}
