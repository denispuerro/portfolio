import { defineConfig } from 'vite';

// Nom du dépôt GitHub Pages : lagencepointcom/Porfolio ou denispuerro/portfolio
const REPO_NAME =
  process.env.GITHUB_REPOSITORY?.split('/')[1] ||
  process.env.PAGES_REPO ||
  'Porfolio';

// Port unique pour dev ET preview — toujours http://localhost:5173/
const PORT = 5173;

const BACKGROUND_ASSETS = [
  { href: 'images/arriere-plan/background-univers-denis.jpg', type: 'image/jpeg', fetchpriority: 'high' },
  { href: 'images/arriere-plan/background-explore.jpg', type: 'image/jpeg' },
  { href: 'images/arriere-plan/background-appli.jpg', type: 'image/jpeg' },
  { href: 'images/arriere-plan/background-graphic-design.jpg', type: 'image/jpeg' },
];

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? `/${REPO_NAME}/` : '/',
  server: {
    port: PORT,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  preview: {
    port: PORT,
    strictPort: true,
  },
  plugins: [
    {
      name: 'preload-backgrounds',
      transformIndexHtml(html) {
        const base = process.env.GITHUB_PAGES === 'true' ? `/${REPO_NAME}/` : '/';
        const tags = BACKGROUND_ASSETS.map(({ href, type, fetchpriority }) => {
          const priority = fetchpriority ? ` fetchpriority="${fetchpriority}"` : '';
          return `<link rel="preload" as="image" href="${base}${href}" type="${type}"${priority}>`;
        }).join('\n    ');
        return html.replace('</head>', `    ${tags}\n</head>`);
      },
    },
  ],
});
