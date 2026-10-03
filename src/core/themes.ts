export interface ThemeOption {
  id: string;
  label: string;
  note: string;
}

export const DEFAULT_THEME = 'ember';

export const THEMES: ThemeOption[] = [
  { id: 'ember', label: 'Ember Forge', note: 'the home fire — amber on charcoal' },
  { id: 'onyx', label: 'Onyx Quench', note: 'graphite dark with a sky-steel edge' },
  { id: 'verdigris', label: 'Verdigris', note: 'patina green, copper heat' },
  { id: 'neon', label: 'Neon Foundry', note: 'violet night, magenta spark' },
  { id: 'frost', label: 'Frostlight', note: 'snowfield daylight, cold blue' },
  { id: 'parchment', label: 'Old Parchment', note: 'warm paper, sepia ink' },
];

export const THEME_IDS: string[] = THEMES.map((theme) => theme.id);

export function isTheme(value: unknown): boolean {
  return typeof value === 'string' && THEME_IDS.includes(value);
}

export function resolveTheme(value: unknown): string {
  return isTheme(value) ? String(value) : DEFAULT_THEME;
}
