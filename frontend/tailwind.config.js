/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] }, colors: { ink: '#070b14', panel: '#0d1320', line: '#202a3b', accent: '#22d3ee' }, boxShadow: { glow: '0 0 28px rgba(34,211,238,.12)' } } }, plugins: [] };
