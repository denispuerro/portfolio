import fs from 'fs';
import path from 'path';
import { optimizeAllPublicImages } from './optimize-portfolio-images.js';

const sourceFolders = {
  photos: 'Images/Porfolio photos',
  graphisme: 'Images/Graphisme',
  web: 'Images/Site Web',
};

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

function slugifySegment(value) {
  return value
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function encodeAssetFileName(fileName) {
  return encodeURIComponent(fileName.normalize('NFC'));
}

function collectImageFiles(dir, rootDir = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectImageFiles(fullPath, rootDir, acc);
      continue;
    }
    if (!imagePattern.test(entry.name)) continue;

    const relativeDir = path.relative(rootDir, path.dirname(fullPath));
    acc.push({ fullPath, fileName: entry.name, relativeDir });
  }

  return acc;
}

function resolveDestName({ fileName, relativeDir }, usedNames) {
  if (!relativeDir || relativeDir === '.') {
    const normalized = fileName.normalize('NFC');
    usedNames.add(normalized);
    return normalized;
  }

  const folderSlug = slugifySegment(relativeDir.split(path.sep).filter(Boolean).pop());
  const fileSlug = slugifySegment(path.parse(fileName).name);
  const ext = path.parse(fileName).ext.toLowerCase();

  let destName = `${folderSlug}-${fileSlug}${ext}`;
  if (!usedNames.has(destName)) {
    usedNames.add(destName);
    return destName;
  }

  let index = 2;
  while (usedNames.has(`${destName}-${index}`)) index += 1;
  destName = `${destName}-${index}`;
  usedNames.add(destName);
  return destName;
}

function clearFolderImages(folder) {
  if (!fs.existsSync(folder)) return;
  for (const file of fs.readdirSync(folder)) {
    if (imagePattern.test(file)) {
      fs.unlinkSync(path.join(folder, file));
    }
  }
}

function syncCategory(src, dest, { recursive = false, clean = false } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  if (clean) clearFolderImages(dest);

  const sources = recursive
    ? collectImageFiles(src)
    : fs.readdirSync(src, { withFileTypes: true })
      .filter((entry) => entry.isFile() && imagePattern.test(entry.name))
      .map((entry) => ({
        fullPath: path.join(src, entry.name),
        fileName: entry.name,
        relativeDir: '.',
      }));

  const usedNames = new Set();

  for (const source of sources) {
    const destName = resolveDestName(source, usedNames);
    fs.copyFileSync(source.fullPath, path.join(dest, destName));
  }

  return sources.length;
}

function listPublicImages(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((file) => imagePattern.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function writePortfolioImagesManifest() {
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

function writeWebProjectsManifest() {
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

async function main() {
  let copied = 0;

  for (const [key, src] of Object.entries(sourceFolders)) {
    const dest = publicFolders[key];
    if (!fs.existsSync(src)) continue;
    const recursive = key === 'graphisme';
    const clean = key === 'graphisme';
    copied += syncCategory(src, dest, { recursive, clean });
  }

  console.log(`Copied ${copied} source files to public/`);

  await optimizeAllPublicImages();

  const manifest = writePortfolioImagesManifest();
  writeWebProjectsManifest();

  console.log(`Synced: ${manifest.photos.length} photos, ${manifest.graphisme.length} graphisme, ${manifest.web.length} web`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
