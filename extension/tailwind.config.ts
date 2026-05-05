import type { Config } from 'tailwindcss';

// S1 ships the Tailwind config so npm install resolves all deps; actual
// utility classes only land in S3. Tokens here mirror the existing CSS
// variables in src/sidepanel/styles.css plus the locked Apple system blue
// accent (#0a84ff) chosen in the execution plan.
const config: Config = {
  content: ['./src/**/*.{ts,tsx,html,js}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#f5f5f7',
        ink: '#1d1d1f',
        muted: '#6e6e73',
        subtle: '#86868b',
        line: '#d2d2d7',
        panel: '#ffffff',
        accent: {
          DEFAULT: '#0a84ff',
          soft: '#e7f1ff',
        },
        success: {
          DEFAULT: '#197a4d',
          soft: '#dcefe5',
        },
        warning: {
          DEFAULT: '#8a5a00',
          soft: '#f5e7c4',
        },
        danger: {
          DEFAULT: '#b3261e',
          soft: '#f8dfda',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        button: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.06)',
        elevated: '0 12px 28px rgba(0, 0, 0, 0.12)',
      },
      spacing: {
        // 8pt grid extension; default Tailwind already covers most.
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
