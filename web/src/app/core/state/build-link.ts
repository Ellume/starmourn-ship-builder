import { DataService } from '../data/data.service';
import { BuildStore } from './build.store';

/** Compact wire format for a shared build — short keys since this rides in a URL. */
interface SharedBuild {
  h: number;
  c?: number;
  e?: number;
  s?: number;
  ss?: number;
  sn?: number;
  m?: number[];
  mo?: { s: string; l: number }[];
}

const URL_PARAM = 'b';

function toBase64Url(json: string): string {
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=');
  return decodeURIComponent(escape(atob(padded)));
}

/** Encodes the current build into a URL-safe token for the `b` query param. */
export function encodeBuild(build: BuildStore): string {
  const hull = build.hull();
  if (!hull) return '';

  const shared: SharedBuild = { h: hull.id };
  const capacitor = build.capacitor();
  const engine = build.engine();
  const shield = build.shield();
  const shipsim = build.shipsim();
  const sensor = build.sensor();
  if (capacitor) shared.c = capacitor.id;
  if (engine) shared.e = engine.id;
  if (shield) shared.s = shield.id;
  if (shipsim) shared.ss = shipsim.id;
  if (sensor) shared.sn = sensor.id;

  const modules = build.modules();
  if (modules.length) shared.m = modules.map((m) => m.id);

  const mods = build.mods();
  if (mods.length) shared.mo = mods.map((m) => ({ s: m.shortname, l: m.level }));

  return toBase64Url(JSON.stringify(shared));
}

/** Builds the full shareable URL for the current build (page's own origin/path + encoded token). */
export function buildShareUrl(build: BuildStore): string {
  const token = encodeBuild(build);
  const base = `${location.origin}${location.pathname}`;
  return token ? `${base}?${URL_PARAM}=${token}` : base;
}

export function hasSharedBuildInUrl(): boolean {
  return new URLSearchParams(location.search).has(URL_PARAM);
}

/**
 * Decodes the `b` query param (if present) and applies it to the store, looking up each
 * id against the loaded data catalog. Unknown/invalid ids are skipped rather than
 * thrown — a share link should degrade gracefully (e.g. after a data snapshot update
 * renumbers something) instead of leaving the app in a broken state.
 */
export function applySharedBuildFromUrl(build: BuildStore, data: DataService): boolean {
  const token = new URLSearchParams(location.search).get(URL_PARAM);
  if (!token) return false;

  let shared: SharedBuild;
  try {
    shared = JSON.parse(fromBase64Url(token));
  } catch {
    return false;
  }
  if (typeof shared.h !== 'number') return false;

  const hull = data.shipModels().find((m) => m.id === shared.h);
  if (!hull) return false;
  build.setHull(hull);

  const findComponent = (type: 'Capacitor' | 'Engine' | 'Shield' | 'Shipsim' | 'Sensor', id: number | undefined) =>
    id == null ? null : (data.componentsByType(type).find((c) => c.id === id) ?? null);

  const capacitor = findComponent('Capacitor', shared.c);
  if (capacitor) build.capacitor.set(capacitor);
  const engine = findComponent('Engine', shared.e);
  if (engine) build.engine.set(engine);
  const shield = findComponent('Shield', shared.s);
  if (shield) build.shield.set(shield);
  const shipsim = findComponent('Shipsim', shared.ss);
  if (shipsim) build.shipsim.set(shipsim);
  const sensor = findComponent('Sensor', shared.sn);
  if (sensor) build.sensor.set(sensor);

  for (const moduleId of shared.m ?? []) {
    const module = data.modules().find((m) => m.id === moduleId);
    if (module) build.addModule(module);
  }

  const knownShortnames = new Set(data.shipMods().map((m) => m.shortname));
  for (const mod of shared.mo ?? []) {
    if (!knownShortnames.has(mod.s) || !Number.isInteger(mod.l) || mod.l < 1 || mod.l > 15) continue;
    build.addMod(mod.s);
    build.setModLevel(mod.s, mod.l);
  }

  return true;
}
