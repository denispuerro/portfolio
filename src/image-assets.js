const FORMAT_PRIORITY = ['webp', 'png', 'jpg', 'jpeg', 'gif'];

export function imageStemFromPath(relativePath) {
  const file = relativePath.split('/').pop() || relativePath;
  return decodeURIComponent(file.replace(/\.[^.]+$/, ''));
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
