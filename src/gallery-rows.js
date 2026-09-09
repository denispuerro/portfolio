const FORMATS = ['portrait', 'landscape', 'square', 'wide'];

function pickNextFormat(...avoid) {
  const blocked = new Set(avoid.filter(Boolean));
  return FORMATS.find((format) => !blocked.has(format))
    || FORMATS[(FORMATS.indexOf(avoid[0]) + 1 + blocked.size) % FORMATS.length];
}

/** Répartit les formats pour éviter les doublons horizontaux et verticaux. */
export function assignMixedDisplayFormats(rowItems) {
  const rowCount = rowItems.length;
  const maxLen = Math.max(...rowItems.map((row) => row.length), 0);

  for (let col = 0; col < maxLen; col += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      const item = rowItems[row][col];
      if (!item) continue;

      const left = col > 0 ? rowItems[row][col - 1]?.format : null;
      const above = row > 0 ? rowItems[row - 1][col]?.format : null;
      const format = pickNextFormat(left, above);

      item.format = format;
      item.formatLocked = true;
    }
  }

  return rowItems;
}

function duplicateRowWithMixedFormats(items) {
  if (!items.length) return [];
  let prev = items[items.length - 1]?.format;
  return items.map((item) => {
    const format = pickNextFormat(prev);
    prev = format;
    return { ...item, format, formatLocked: true };
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function classifyAspectRatio(width, height) {
  if (!width || !height) return 'landscape';
  const ratio = width / height;
  if (ratio < 0.82) return 'portrait';
  if (ratio > 1.55) return 'wide';
  if (ratio > 1.12) return 'landscape';
  return 'square';
}

function setItemFormat(item, format) {
  FORMATS.forEach((name) => item.classList.remove(`pv-gallery-item--${name}`));
  item.classList.add(`pv-gallery-item--${format}`);
}

export function expandItems(items, minPerRow = 8) {
  if (!items.length) return [];
  const expanded = [];
  while (expanded.length < minPerRow) expanded.push(...items);
  return expanded;
}

export function splitAcrossRows(items, rowCount) {
  const rows = Array.from({ length: rowCount }, () => []);
  items.forEach((item, index) => {
    rows[index % rowCount].push(item);
  });
  return rows;
}

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Alterne portrait / paysage — chaque vidéo n'apparaît qu'une fois. */
export function splitVideoRowsBalanced(items, rowCount) {
  const portraits = shuffleArray(items.filter((item) => item.format === 'portrait'));
  const landscapes = shuffleArray(items.filter((item) => item.format === 'landscape'));

  if (!portraits.length && !landscapes.length) {
    return Array.from({ length: rowCount }, () => []);
  }

  const interleaved = [];
  let portraitIndex = 0;
  let landscapeIndex = 0;

  while (portraitIndex < portraits.length || landscapeIndex < landscapes.length) {
    if (portraitIndex < portraits.length) {
      interleaved.push({ ...portraits[portraitIndex] });
      portraitIndex += 1;
    }
    if (landscapeIndex < landscapes.length) {
      interleaved.push({ ...landscapes[landscapeIndex] });
      landscapeIndex += 1;
    }
  }

  if (rowCount <= 1) return [interleaved];
  return splitAcrossRows(interleaved, rowCount);
}

function renderGalleryItem(item) {
  const format = item.format || 'landscape';
  const type = item.type || 'image';
  const showLabel = item.label && type !== 'video';
  const label = showLabel ? `<span class="pv-gallery-label">${escapeHtml(item.label)}</span>` : '';
  const siteClass = type === 'web' ? ' pv-gallery-item--site' : '';
  const formatLocked = item.formatLocked ? ' data-format-locked="true"' : '';
  const attrs = [
    `class="pv-gallery-item pv-gallery-item--${format}${siteClass}"`,
    `data-type="${type}"`,
    item.url ? `data-url="${escapeHtml(item.url)}"` : '',
    item.videoId ? `data-video-id="${escapeHtml(item.videoId)}"` : '',
    item.fullSrc ? `data-full-src="${escapeHtml(item.fullSrc)}"` : '',
    item.srcFallbacks?.length ? `data-src-fallbacks="${escapeHtml(item.srcFallbacks.join('|'))}"` : '',
    item.thumbFallbacks?.length ? `data-thumb-fallbacks="${escapeHtml(item.thumbFallbacks.join('|'))}"` : '',
    formatLocked,
  ].filter(Boolean).join(' ');

  const imgHtml = `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || '')}" decoding="async" loading="eager">`;
  const mediaHtml = type === 'video'
    ? `<div class="pv-gallery-video-media">${imgHtml}</div>`
    : imgHtml;

  return (
    `<button type="button" ${attrs} aria-label="${escapeHtml(item.alt || item.label || 'Projet')}">` +
    mediaHtml +
    label +
    `</button>`
  );
}

export function buildGalleryRows(container, rowItems, { duplicate = true, alternateDuplicateFormats = false } = {}) {
  const rows = container.querySelectorAll('.pv-gallery-row');
  rows.forEach((row, rowIndex) => {
    const items = rowItems[rowIndex] || [];
    const trackItems = duplicate
      ? (alternateDuplicateFormats
        ? [...items, ...duplicateRowWithMixedFormats(items)]
        : [...items, ...items])
      : items;
    row.innerHTML = `<div class="pv-gallery-track">${trackItems.map((item) => renderGalleryItem(item)).join('')}</div>`;
  });
}

function applyImageFormat(img) {
  const item = img.closest('.pv-gallery-item');
  if (!item || item.dataset.formatLocked === 'true') return;

  const apply = () => {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return;
    setItemFormat(item, classifyAspectRatio(w, h));
  };

  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener('load', apply, { once: true });
}

export function applyGalleryAspectRatios(gallery) {
  gallery.querySelectorAll('.pv-gallery-item img').forEach(applyImageFormat);
}

function revealGalleryImage(img) {
  if (!img?.naturalWidth) return;
  img.classList.add('is-ready');
  img.dataset.loading = 'false';
    const galleryKind = img.closest('.pv-gallery')?.dataset.gallery;
    if (!['photos', 'video', 'web', 'design'].includes(galleryKind)) {
      applyImageFormat(img);
    }
}

function loadGalleryImage(img, { skipCurrent = false, onDone } = {}) {
  if (!img || img.classList.contains('is-ready')) {
    onDone?.();
    return;
  }
  if (img.dataset.loading === 'true') {
    onDone?.();
    return;
  }

  const item = img.closest('.pv-gallery-item, .pv-carousel-item');
  const currentSrc = img.getAttribute('src') || '';
  const extraRaw = item?.dataset.type === 'video'
    ? item.dataset.thumbFallbacks
    : item.dataset.srcFallbacks;
  let urls = [...new Set([currentSrc, ...(extraRaw || '').split('|')].filter(Boolean))];

  if (skipCurrent && currentSrc) {
    urls = urls.filter((url) => url !== currentSrc);
  }

  if (!urls.length) {
    onDone?.();
    return;
  }

  img.dataset.loading = 'true';

  let index = 0;
  const finish = () => {
    img.dataset.loading = 'false';
    onDone?.();
  };

  const tryNext = () => {
    if (index >= urls.length) {
      finish();
      return;
    }
    const nextUrl = urls[index];
    index += 1;
    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      revealGalleryImage(img);
      finish();
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      tryNext();
    };
    img.src = nextUrl;
  };

  tryNext();
}

function bindGalleryImage(img) {
  if (!img || img.classList.contains('is-ready')) return;

  if (img.complete && img.naturalWidth > 0) {
    revealGalleryImage(img);
    return;
  }

  img.addEventListener('load', () => revealGalleryImage(img), { once: true });
  img.addEventListener('error', () => loadGalleryImage(img, { skipCurrent: true }), { once: true });
}

function loadAllGalleryImages(track) {
  track.querySelectorAll('img').forEach(bindGalleryImage);
}

function stopVideoPreview(item) {
  const media = item.querySelector('.pv-gallery-video-media');
  if (!media) return;
  media.querySelector('iframe')?.remove();
  media.querySelector('img')?.classList.remove('is-hidden');
}

function startVideoPreview(item) {
  const videoId = item.dataset.videoId;
  if (!videoId) return;
  const media = item.querySelector('.pv-gallery-video-media');
  if (!media || media.querySelector('iframe')) return;
  const thumb = media.querySelector('img');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.title = item.getAttribute('aria-label') || 'Aperçu vidéo';
  media.appendChild(iframe);
  thumb?.classList.add('is-hidden');
}

function initVideoGalleryPreviews(gallery) {
  const items = gallery.querySelectorAll('.pv-gallery-item[data-type="video"]');
  items.forEach((item) => {
    const activate = () => {
      items.forEach((other) => {
        if (other !== item) stopVideoPreview(other);
      });
      startVideoPreview(item);
    };
    item.addEventListener('mouseenter', activate);
    item.addEventListener('mouseleave', () => stopVideoPreview(item));
    item.addEventListener('focusin', activate);
    item.addEventListener('focusout', () => stopVideoPreview(item));
  });
  gallery.addEventListener('mouseleave', () => {
    items.forEach(stopVideoPreview);
  });
}

export function initGalleryRows(gallery, handlers = {}) {
  const rows = gallery.querySelectorAll('.pv-gallery-row');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  rows.forEach((row) => {
    const track = row.querySelector('.pv-gallery-track');
    if (!track) return;

    const speed = Number(row.dataset.speed || 40);
    row.style.setProperty('--gallery-duration', `${speed}s`);

    const loadVisibleImages = () => loadAllGalleryImages(track);

    if (reducedMotion) {
      row.classList.add('is-static');
      loadVisibleImages();
      return;
    }

    row.addEventListener('mouseenter', () => row.classList.add('is-paused'));
    row.addEventListener('mouseleave', () => row.classList.remove('is-paused'));
    row.addEventListener('focusin', () => row.classList.add('is-paused'));
    row.addEventListener('focusout', () => row.classList.remove('is-paused'));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          row.classList.toggle('is-visible', entry.isIntersecting);
          if (entry.isIntersecting) loadVisibleImages();
        });
      }, { rootMargin: '240px 0px' });
      observer.observe(row);
    } else {
      row.classList.add('is-visible');
      loadVisibleImages();
    }
  });

  if (!['photos', 'video', 'web', 'design'].includes(gallery.dataset.gallery)) {
    applyGalleryAspectRatios(gallery);
  }

  gallery.querySelectorAll('.pv-gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      loadGalleryImage(item.querySelector('img'));
      const type = item.dataset.type;
      if (type === 'web' && item.dataset.url) {
        handlers.onWeb?.(item.dataset.url);
        return;
      }
      if (type === 'video') {
        stopVideoPreview(item);
        const url = item.dataset.url || (item.dataset.videoId ? `https://www.youtube.com/watch?v=${item.dataset.videoId}` : '');
        if (url) handlers.onVideo?.(url);
        return;
      }
      const img = item.querySelector('img');
      const src = item.dataset.fullSrc || img?.getAttribute('src') || img?.getAttribute('data-src');
      if (src) handlers.onImage?.(src);
    });
  });

  if (gallery.dataset.gallery === 'video') {
    initVideoGalleryPreviews(gallery);
  }
}

export function pickRandomGalleryItem(gallery) {
  const items = [...gallery.querySelectorAll('.pv-gallery-item')];
  if (!items.length) return null;
  const half = Math.floor(items.length / 2) || items.length;
  return items[Math.floor(Math.random() * half)];
}
