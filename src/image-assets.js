const FORMAT_PRIORITY = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
const VARIANT_SUFFIXES = ['', '-480', '-640', '-960', '-full'];

export function imageStemFromPath(relativePath) {
  const file = relativePath.split('/').pop() || relativePath;
  return decodeURIComponent(file.replace(/\.[^.]+$/, '').replace(/-(480|640|960|full)$/, ''));
}

function imageDirFromPath(relativePath) {
  const idx = relativePath.lastIndexOf('/');
  return idx === -1 ? '' : relativePath.slice(0, idx);
}

function imageExtension(relativePath) {
  return relativePath.split('.').pop()?.toLowerCase() || '';
}

function encodeFileStem(stem) {
  return encodeURIComponent(stem.normalize('NFC'));
}

function buildVariantPaths(relativePath, suffix) {
  const dir = imageDirFromPath(relativePath);
  const stem = imageStemFromPath(relativePath);
  const ext = imageExtension(relativePath) || 'webp';
  const fileName = `${encodeFileStem(stem)}${suffix}.${ext}`;
  return dir ? `${dir}/${fileName}` : fileName;
}

/** Chemins relatifs (webp, png, jpg…) pour le même visuel. */
export function buildImageCandidates(relativePath) {
  const dir = imageDirFromPath(relativePath);
  const stem = imageStemFromPath(relativePath);
  const preferredExt = imageExtension(relativePath);
  const ordered = preferredExt
    ? [preferredExt, ...FORMAT_PRIORITY.filter((ext) => ext !== preferredExt)]
    : FORMAT_PRIORITY;
  const unique = [...new Set(ordered)];

  return unique.map((ext) => {
    const fileName = `${encodeFileStem(stem)}.${ext}`;
    return dir ? `${dir}/${fileName}` : fileName;
  });
}

export function resolveImageUrls(relativePath, toUrl) {
  const candidates = buildImageCandidates(relativePath);
  const urls = candidates.map(toUrl);
  return { src: urls[0], fallbacks: urls.slice(1) };
}

/** Galerie : vignette légère + original pour lightbox. */
export function resolveGalleryImageUrls(relativePath, toUrl) {
  const galleryCandidates = [
    buildVariantPaths(relativePath, ''),
    ...buildImageCandidates(relativePath),
  ];
  const fullCandidates = [
    buildVariantPaths(relativePath, '-full'),
    buildVariantPaths(relativePath, ''),
    ...buildImageCandidates(relativePath),
  ];

  const galleryUrls = [...new Set(galleryCandidates.map(toUrl))];
  const fullUrls = [...new Set(fullCandidates.map(toUrl))];

  return {
    src: galleryUrls[0],
    fullSrc: fullUrls[0],
    fallbacks: galleryUrls.slice(1),
  };
}
