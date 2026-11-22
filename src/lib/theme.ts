import { useSyncExternalStore } from 'react'

/*
  Theme preference (M10): "light", "dark" or "system" (follow the device).
  Stored in localStorage and applied as data-theme on <html>; the CSS in index.css does the rest.
  index.html applies the stored choice before first paint, so pages never flash the wrong theme.
  The landing page and the app share this, so the choice survives navigation and reloads.
*/

export type ThemePreference = 'light' | 'dark' | 'system'
export const THEME_STORAGE_KEY = 'theme'

const listeners = new Set<() => void>()

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** The theme actually shown: the stored choice, or the device setting for "system". */
export function resolveTheme(preference: ThemePreference = readThemePreference()): 'light' | 'dark' {
  return preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
  applyThemePreference(preference)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  media?.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', listener)
  }
}

/** The current preference and the theme it resolves to; re-renders when either changes. */
export function useTheme(): { preference: ThemePreference; theme: 'light' | 'dark'; setPreference: (preference: ThemePreference) => void } {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => 'system' as const)
  const theme = useSyncExternalStore(subscribe, () => resolveTheme(preference), () => 'light' as const)
  return { preference, theme, setPreference: setThemePreference }
}
