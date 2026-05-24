/**
 * Phase 1 identity is just a display name in localStorage.
 * Phase 2 adds a GenLayer wallet via useGenLayer().
 */
import { storage } from "./storage";   // FIXED: #17

const NAME_KEY = "bc_display_name";

export function getDisplayName(): string {
  const existing = storage.get(NAME_KEY);   // FIXED: #17
  if (existing) return existing;
  const n = pickName();
  storage.set(NAME_KEY, n);                 // FIXED: #17
  return n;
}

export function setDisplayName(name: string): string {
  const clean = name.trim().slice(0, 24) || pickName();
  storage.set(NAME_KEY, clean);             // FIXED: #17
  return clean;
}

const ADJ = ["Sly", "Bold", "Grim", "Merry", "Sneaky", "Loud", "Tiny", "Wise", "Cursed"];
const NOUN = ["Badger", "Poet", "Gremlin", "Magistrate", "Goose", "Rogue", "Bard", "Pigeon"];
function pickName() {
  return `${pick(ADJ)}${pick(NOUN)}${Math.floor(Math.random() * 100)}`;
}
function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }
