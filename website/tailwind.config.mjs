/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0e0d0b',
          2: '#15140f',
          3: '#1c1a14',
          4: '#24211a',
        },
        ink: {
          DEFAULT: '#f0ebde',
          2: '#c8c2b0',
          3: '#a39d8a',
          4: '#6e6957',
          5: '#4a463a',
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          2: 'rgba(255,255,255,0.10)',
        },
        accent: {
          DEFAULT: '#7dd3a0',
          2: '#5fb685',
          soft: 'rgba(125,211,160,0.10)',
          line: 'rgba(125,211,160,0.25)',
        },
        warn: '#e0b870',
        info: '#7aa2f7',
        danger: '#f17a7a',
        violet: '#c897e0',
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
        ui: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '12px',
        xl: '18px',
      },
      maxWidth: {
        wrap: '1180px',
      },
    },
  },
  plugins: [],
}
