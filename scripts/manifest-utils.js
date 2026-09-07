import fs from 'fs';
import path from 'path';

const publicFolders = {
  photos: 'public/images/portfolio-photos',
  graphisme: 'public/images/graphisme',
  web: 'public/images/site-web',
};

const webProjectsConfig = [
  { name: 'Swiss Seniors', stem: 'web_swissseniors', url: 'https://www.swissseniors.ch' },
  { name: 'Welsh Stud', stem: 'web_welshstud', url: 'https://www.welshstud.ch' },
  { name: "L'Agence Point Com", stem: 'web_lagencepointcom', url: 'https://www.lagencepointcom.ch' },
  { name: 'CISO Salon', stem: 'web_cisosalon', url: 'https://www.cisosalon.ch' },
  { name: 'Freelance Comptabilité', stem: 'web-Freelancecomptabilite', url: 'https://www.freelancecomptabilite.ch' },
];

const imagePattern = /\.(png|jpe?g|webp|gif)$/i;

function encodeAssetFileName(fileName) {
  return encodeURIComponent(fileName.normalize('NFC'));
}

function listPublicImages(folder) {
  if (!fs.existsSync(folder)) return [];
  const files = fs.readdirSync(folder)
    .filter((file) => imagePattern.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const webpStems = new Set(
    files
      .filter((file) => file.toLowerCase().endsWith('.webp'))
      .map((file) => path.parse(file).name),
  );

  return files.filter((file) => {
    const { name, ext } = path.parse(file);
    if (webpStems.has(name) && ext.toLowerCase() !== '.webp') return false;
    return true;
  });
}

export function writePortfolioImagesManifest() {
  const out = {};
  for (const [key, folder] of Object.entries(publicFolders)) {
    const files = listPublicImages(folder);
    out[key] = files.map((f) => `images/${path.basename(folder)}/${encodeAssetFileName(f)}`);
  }

  fs.writeFileSync(
    'src/portfolio-images.js',
    `export const portfolioImages = ${JSON.stringify(out, null, 2)};\n`,
  );

  return out;
}

export function writeWebProjectsManifest() {
  const webDir = publicFolders.web;
  const files = listPublicImages(webDir);

  const projects = webProjectsConfig.map(({ name, stem, url }) => {
    const match = files.find((file) => file.startsWith(stem));
    if (!match) {
      throw new Error(`Image web introuvable pour « ${name} » (${stem})`);
    }
    return {
      name,
      image: `images/site-web/${encodeAssetFileName(match)}`,
      url,
    };
  });

  fs.writeFileSync(
    'src/web-projects.js',
    `export const webProjects = ${JSON.stringify(projects, null, 2)};\n`,
  );
}

export function refreshManifests() {
  const manifest = writePortfolioImagesManifest();
  writeWebProjectsManifest();
  console.log(`Manifest: ${manifest.photos.length} photos, ${manifest.graphisme.length} graphisme, ${manifest.web.length} web`);
  return manifest;
}
