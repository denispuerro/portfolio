import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Nom du dépôt GitHub Pages : lagencepointcom/Porfolio ou denispuerro/portfolio
const REPO_NAME =
  process.env.GITHUB_REPOSITORY?.split('/')[1] ||
  process.env.PAGES_REPO ||
  'Porfolio';

const PORT = 5173;
const onNetworkVolume = process.cwd().startsWith('/Volumes/');

const BACKGROUND_ASSETS = [
  { href: 'images/arriere-plan/background-univers-denis.jpg', type: 'image/jpeg', fetchpriority: 'high' },
];

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? `/${REPO_NAME}/` : '/',
  // Cache Vite sur le disque local — évite 30+ s de démarrage sur /Volumes/Commun
  cacheDir: path.join(os.homedir(), '.cache', 'porfolio-vite'),
  server: {
    port: PORT,
    strictPort: true,
    host: '127.0.0.1',
    // Sur disque réseau : pas de watcher ni HMR (évite crash EBADF)
    watch: onNetworkVolume ? null : undefined,
    hmr: onNetworkVolume ? false : undefined,
  },
  preview: {
    port: PORT,
    strictPort: true,
    host: '127.0.0.1',
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
