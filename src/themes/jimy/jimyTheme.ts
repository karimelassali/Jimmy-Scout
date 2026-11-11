import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

export const jimyTheme = defineTheme({
  name: 'jimy',
  extends: neutralTheme,
  tokens: {
    '--color-accent': ['#FF6B00', '#FF8533'],
    '--color-accent-muted': ['#FF6B001F', '#FF853329'],
    '--color-on-accent': ['#FFFFFF', '#FFFFFF'],
    '--color-text-accent': ['#C94F00', '#FF9E5E'],
    '--color-icon-accent': ['#FF6B00', '#FF8533'],
    '--color-text-primary': ['#0B2240', '#F1F5F9'],
    '--color-text-secondary': ['#475569', '#94A3B8'],
    '--color-icon-primary': ['#0B2240', '#F1F5F9'],
    '--color-icon-secondary': ['#475569', '#94A3B8'],
    '--color-background-body': ['#F0F4F9', '#0B1320'],
    '--color-background-surface': ['#FFFFFF', '#111C2D'],
    '--color-background-card': ['#FFFFFF', '#152238'],
    '--color-background-popover': ['#FFFFFF', '#1B2B45'],
    '--color-border': ['#0B22401A', '#F1F5F91F'],
    '--color-border-emphasized': ['#CBD5E1', '#334155'],
    '--font-family-heading': '"Plus Jakarta Sans", "Figtree", -apple-system, BlinkMacSystemFont, sans-serif',
    '--font-family-body': '"DM Sans", "Figtree", -apple-system, BlinkMacSystemFont, sans-serif',
    '--font-family-code': '"JetBrains Mono", monospace',
  },
});
