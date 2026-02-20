import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#070b14',
        'navy-deep': '#0a1128',
        navy: '#0f1b3d',
        'indigo-deep': '#1a0a3e',
        'bio-glow': '#00ffd5',
        'neon-cyan': '#22d3ee',
        'neon-purple': '#a855f7',
        'neon-pink': '#ec4899',
        'neon-blue': '#3b82f6',
        'neon-emerald': '#34d399',
        accent: 'hsl(var(--accent))',
        'accent-hover': 'hsl(var(--accent-hover))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',
        warning: 'hsl(var(--warning))',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
