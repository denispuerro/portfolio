import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const imagePattern = /\.(png|jpe?g|webp|gif)$/i;
const variantSuffixPattern = /-(480|640|960|full)$/;

const folderRules = {
  'public/images/portfolio-photos': {
    format: 'webp',
    variants: [
      { suffix: '', maxWidth: 640, quality: 78 },
      { suffix: '-full', maxWidth: 1920, quality: 82 },
    ],
  },
  'public/images/graphisme': {
    format: 'webp',
    variants: [
      { suffix: '', maxWidth: 720, quality: 80 },
      { suffix: '-full', maxWidth: 1600, quality: 84 },
    ],
  },
  'public/images/site-web': {
    format: 'webp',
    variants: [
      { suffix: '', maxWidth: 960, quality: 82 },
      { suffix: '-full', maxWidth: 1440, quality: 86 },
    ],
  },
  'public/images/arriere-plan': {
    format: 'jpeg',
    variants: [{ suffix: '', maxWidth: 1920, quality: 82 }],
  },
};

function baseStem(fileName) {
  const parsed = path.parse(fileName);
  return parsed.name.replace(variantSuffixPattern, '');
}

function collectSourceFiles(folder) {
  if (!fs.existsSync(folder)) return [];

  const byStem = new Map();
  for (const file of fs.readdirSync(folder)) {
    if (!imagePattern.test(file)) continue;
    const stem = baseStem(file);
    const current = byStem.get(stem);
    const fullPath = path.join(folder, file);
    if (!current || fs.statSync(fullPath).mtimeMs >= fs.statSync(current).mtimeMs) {
      byStem.set(stem, fullPath);
    }
  }
  return [...byStem.values()];
}

async function writeVariant(inputPath, outPath, rule, variant) {
  const tempPath = `${outPath}.tmp`;
  let pipeline = sharp(inputPath, { failOn: 'none' });
  const metadata = await pipeline.metadata();

  if (metadata.width && metadata.width > variant.maxWidth) {
    pipeline = pipeline.resize({ width: variant.maxWidth, withoutEnlargement: true });
  }

  if (rule.format === 'jpeg') {
    await pipeline
      .jpeg({ quality: variant.quality, mozjpeg: true, progressive: true })
      .toFile(tempPath);
  } else {
    await pipeline
      .webp({ quality: variant.quality, effort: 4, smartSubsample: true })
      .toFile(tempPath);
  }

  fs.renameSync(tempPath, outPath);
}

export async function optimizeFolder(folder, rule) {
  if (!fs.existsSync(folder)) return { count: 0, savedBytes: 0 };

  const sources = collectSourceFiles(folder);
  let count = 0;
  let savedBytes = 0;

  for (const inputPath of sources) {
    const before = fs.statSync(inputPath).size;
    const stem = baseStem(path.basename(inputPath));
    const ext = rule.format === 'jpeg' ? '.jpg' : '.webp';

    for (const variant of rule.variants) {
      const outPath = path.join(folder, `${stem}${variant.suffix}${ext}`);
      await writeVariant(inputPath, outPath, rule, variant);
    }

    if (inputPath !== path.join(folder, `${stem}${ext}`)) {
      fs.unlinkSync(inputPath);
    }

    const variantBytes = rule.variants.reduce((sum, variant) => {
      const outPath = path.join(folder, `${stem}${variant.suffix}${ext}`);
      return sum + (fs.existsSync(outPath) ? fs.statSync(outPath).size : 0);
    }, 0);

    savedBytes += Math.max(0, before - variantBytes);
    count += 1;
  }

  return { count, savedBytes };
}

export async function optimizeAllPublicImages() {
  let totalCount = 0;
  let totalSaved = 0;

  for (const [folder, rule] of Object.entries(folderRules)) {
    const { count, savedBytes } = await optimizeFolder(folder, rule);
    totalCount += count;
    totalSaved += savedBytes;
    console.log(`Optimized ${count} files in ${folder}`);
  }

  const savedMb = (totalSaved / (1024 * 1024)).toFixed(1);
  console.log(`Total optimized: ${totalCount} files, ~${savedMb} MB saved`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  optimizeAllPublicImages().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
