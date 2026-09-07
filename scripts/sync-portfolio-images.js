import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshManifests } from './manifest-utils.js';

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

function syncSourcesToPublic() {
  let copied = 0;

  for (const [key, src] of Object.entries(sourceFolders)) {
    const dest = publicFolders[key];
    if (!fs.existsSync(src)) continue;
    const recursive = key === 'graphisme' || key === 'photos';
    copied += syncCategory(src, dest, { recursive, clean: true });
  }

  console.log(`Copied ${copied} source files to public/`);
  return copied;
}

async function main() {
  syncSourcesToPublic();
  refreshManifests();
  console.log('Done. Run npm run images:optimize only when you need WebP compression.');
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
