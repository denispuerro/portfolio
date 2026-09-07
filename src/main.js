import './style.css';
import { portfolioImages } from './portfolio-images.js';
import { webProjects } from './web-projects.js';
import { videoProjects } from './video-projects.js';
import {
  buildGalleryRows,
  assignMixedDisplayFormats,
  splitVideoRowsBalanced,
  expandItems,
  initGalleryRows,
  pickRandomGalleryItem,
  splitAcrossRows,
} from './gallery-rows.js';
import { imageStemFromPath, resolveImageUrls } from './image-assets.js';

// Portfolio carousels populated at init

function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function preferWebpAssets(paths = []) {
  const webpStems = new Set(
    paths
      .filter((src) => src.toLowerCase().endsWith('.webp'))
      .map((src) => src.replace(/\.webp$/i, '')),
  );
  return paths.filter((src) => {
    if (src.toLowerCase().endsWith('.webp')) return true;
    const stem = src.replace(/\.(png|jpe?g|gif)$/i, '');
    return !webpStems.has(stem);
  });
}

const BACKGROUNDS = [
  {
    variable: '--hero-bg-image',
    path: 'images/arriere-plan/background-univers-denis.jpg',
    targets: ['.pv-hero-bg', '.pv-contact-bg'],
    priority: 'high',
  },
  {
    variable: '--explore-bg-image',
    path: 'images/arriere-plan/background-explore.jpg',
    targets: ['.pv-transition-explore .pv-transition-bg'],
  },
  {
    variable: '--web-bg-image',
    path: 'images/arriere-plan/background-appli.jpg',
    targets: ['.pv-transition-web .pv-transition-bg'],
  },
  {
    variable: '--design-bg-image',
    path: 'images/arriere-plan/background-graphic-design.jpg',
    targets: ['.pv-transition-design .pv-transition-bg'],
  },
];

function markBackgroundLoaded(selectors) {
  const apply = () => selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.classList.add('is-loaded'));
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
}

function setupBackgrounds() {
  BACKGROUNDS.forEach(({ variable, path }) => {
    document.documentElement.style.setProperty(variable, `url(${assetUrl(path)})`);
  });
}

function preloadBackgrounds() {
  BACKGROUNDS.forEach(({ path, targets, priority }) => {
    const img = new Image();
    if (priority === 'high' && 'fetchPriority' in img) img.fetchPriority = 'high';
    img.decoding = 'async';
    img.onload = () => markBackgroundLoaded(targets);
    img.onerror = () => markBackgroundLoaded(targets);
    img.src = assetUrl(path);
  });
}

setupBackgrounds();
preloadBackgrounds();

function youtubeId(urlOrId) {
  if (!/[/?]/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/);
  return match ? match[1] : urlOrId;
}

function isYoutubeShort(url) {
  return /youtube\.com\/shorts\//i.test(url);
}

function youtubeWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

function youtubeThumbCandidates(id, { isShort = false } = {}) {
  if (isShort) {
    // oardefault often 404s on Shorts; maxresdefault/hqdefault are reliable
    return [
      `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    ];
  }
  return [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
  ];
}

function youtubeThumbUrl(id, { isShort = false } = {}) {
  return youtubeThumbCandidates(id, { isShort })[0];
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pickShuffleSequence(itemCount, fromIndex, toIndex, steps = 11) {
  const sequence = [];
  if (itemCount <= 1) return [toIndex];

  for (let i = 0; i < steps - 1; i += 1) {
    let idx = Math.floor(Math.random() * itemCount);
    let guard = 0;
    while ((idx === fromIndex || idx === toIndex || idx === sequence[sequence.length - 1]) && guard < 8) {
      idx = Math.floor(Math.random() * itemCount);
      guard += 1;
    }
    sequence.push(idx);
  }
  sequence.push(toIndex);
  return sequence;
}

function waitForCarouselItem(item, timeoutMs = 5000) {
  ensureCarouselImage(item);
  const img = item.querySelector('img:not(.pv-video-thumb)');
  if (!img) return Promise.resolve();

  if (img.classList.contains('is-ready') || (img.complete && img.naturalWidth > 0)) {
    img.classList.add('is-ready');
    item.classList.remove('is-loading');
    return Promise.resolve();
  }

  item.classList.add('is-loading');

  return new Promise((resolve) => {
    const done = () => {
      img.classList.add('is-ready');
      item.classList.remove('is-loading');
      resolve();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

function ensureCarouselImage(item) {
  const img = item.querySelector('img:not(.pv-video-thumb)');
  if (!img) return;

  const reveal = () => {
    img.classList.add('is-ready');
    item.classList.remove('is-loading');
  };

  const pendingSrc = img.getAttribute('data-src');
  if (pendingSrc) {
    item.classList.add('is-loading');
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', reveal, { once: true });
    img.src = pendingSrc;
    img.removeAttribute('data-src');
    img.removeAttribute('loading');
    return;
  }

  if (img.complete && img.naturalWidth > 0) reveal();
  else {
    item.classList.add('is-loading');
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', reveal, { once: true });
  }
}

function getCarouselImageSrc(img) {
  if (!img) return '';
  return img.getAttribute('src') || img.getAttribute('data-src') || '';
}

function handleCarouselTap(item, openLightbox) {
  if (!item?.classList.contains('is-active')) return;

  const itemType = item.getAttribute('data-type');
  if (itemType === 'web') {
    const siteUrl = item.getAttribute('data-url');
    if (siteUrl) window.open(siteUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (itemType === 'video') return;

  ensureCarouselImage(item);
  const img = item.querySelector('img:not(.pv-video-thumb)');
  const src = getCarouselImageSrc(img);
  if (src) openLightbox(src);
}

function preloadCarouselNeighbors(items, modIndex) {
  const len = items.length;
  [modIndex, (modIndex + 1) % len, (modIndex - 1 + len) % len].forEach((index) => {
    ensureCarouselImage(items[index]);
  });
}

function preloadCarouselBatch(items, startIndex = 0, batchSize = 6) {
  for (let i = startIndex; i < Math.min(items.length, startIndex + batchSize); i += 1) {
    ensureCarouselImage(items[i]);
  }
}

function setupCarouselSectionPreload(section) {
  const container = section.querySelector('.pv-carousel-container');
  if (!container) return;

  const items = container.querySelectorAll('.pv-carousel-item');
  if (!items.length) return;

  preloadCarouselBatch(items, 0, 8);

  const loadRest = () => {
    let index = 8;
    const step = () => {
      preloadCarouselBatch(items, index, 6);
      index += 6;
      if (index < items.length) {
        if ('requestIdleCallback' in window) requestIdleCallback(step, { timeout: 1500 });
        else setTimeout(step, 120);
      }
    };
    step();
  };

  if (!('IntersectionObserver' in window)) {
    loadRest();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return;
    observer.disconnect();
    loadRest();
  }, { rootMargin: '500px 0px' });

  observer.observe(section);
}

function buildCarouselItems(container, images, type, { eagerCount = 8 } = {}) {
  container.innerHTML = images.map((src, index) => {
    const { src: primary, fallbacks } = resolveImageUrls(src, assetUrl);
    const fileName = imageStemFromPath(src);
    const alt = `${type} ${fileName}`;
    const fallbackAttr = fallbacks.length
      ? ` data-src-fallbacks="${fallbacks.map(encodeURI).join('|')}"`
      : '';
    const eager = index < eagerCount;
    const imgTag = eager
      ? `<img src="${primary}" alt="${alt}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'auto'}"${fallbackAttr}>`
      : `<img data-src="${primary}" alt="${alt}" decoding="async"${fallbackAttr}>`;
    return `<div class="pv-carousel-item" data-type="${type}">${imgTag}</div>`;
  }).join('');
}

function buildWebCarouselItems(container, projects) {
  container.innerHTML = projects.map(({ name, image, url }, index) => {
    const imgUrl = assetUrl(image);
    const imgTag = `<img src="${imgUrl}" alt="${name}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'auto'}">`;
    return (
      `<div class="pv-carousel-item" data-type="web" data-url="${url}">` +
      imgTag +
      `<span class="pv-web-label">${name}</span>` +
      `</div>`
    );
  }).join('');
}

function buildVideoCarouselItems(container, projects) {
  container.innerHTML = projects.map(({ title, url }) => {
    const id = youtubeId(url);
    const isShort = isYoutubeShort(url);
    const watchUrl = youtubeWatchUrl(id);
    return (
      `<div class="pv-carousel-item" data-type="video" data-video-id="${id}" data-url="${watchUrl}">` +
      `<div class="pv-video-media">` +
      `<img class="pv-video-thumb" src="${youtubeThumbUrl(id, { isShort })}" alt="${title}" decoding="async">` +
      `</div>` +
      `<span class="pv-video-label">${title}</span>` +
      `</div>`
    );
  }).join('');
}

function setActiveVideoPreview(items, activeIndex) {
  items.forEach((item, index) => {
    const media = item.querySelector('.pv-video-media');
    if (!media) return;

    const thumb = media.querySelector('.pv-video-thumb');
    const iframe = media.querySelector('iframe');

    if (index === activeIndex) {
      if (!iframe) {
        const videoId = item.getAttribute('data-video-id');
        const player = document.createElement('iframe');
        player.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=1`;
        player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        player.allowFullscreen = true;
        player.title = item.querySelector('.pv-video-label')?.textContent || 'Vidéo YouTube';
        media.appendChild(player);
      }
      if (thumb) thumb.classList.add('is-hidden');
      return;
    }

    if (iframe) iframe.remove();
    if (thumb) thumb.classList.remove('is-hidden');
  });
}

function buildImageGalleryItem(relativePath, altPrefix, { eager = false } = {}) {
  const { src, fallbacks } = resolveImageUrls(relativePath, assetUrl);
  const fileName = imageStemFromPath(relativePath);
  return {
    type: 'image',
    src,
    srcFallbacks: fallbacks,
    alt: `${altPrefix} ${fileName}`,
    eager,
  };
}

function buildPhotoGalleryItems(images) {
  return preferWebpAssets(images).map((src) => buildImageGalleryItem(src, 'Photo', { eager: true }));
}

function buildDesignGalleryItems(images) {
  return preferWebpAssets(images).map((src) => buildImageGalleryItem(src, 'Graphisme', { eager: true }));
}

function buildWebGalleryItems(projects) {
  return projects.map(({ name, image, url }) => {
    const { src, fallbacks } = resolveImageUrls(image, assetUrl);
    return {
      type: 'web',
      src,
      srcFallbacks: fallbacks,
      url,
      label: name,
      alt: name,
      format: 'landscape',
      formatLocked: true,
      eager: true,
    };
  });
}

function buildVideoGalleryItems(projects) {
  return projects.map(({ title, url }) => {
    const id = youtubeId(url);
    const isShort = isYoutubeShort(url);
    const thumbs = youtubeThumbCandidates(id, { isShort });
    return {
      type: 'video',
      src: thumbs[0],
      thumbFallbacks: thumbs.slice(1),
      url: youtubeWatchUrl(id),
      videoId: id,
      alt: title,
      format: isShort ? 'portrait' : 'landscape',
      formatLocked: true,
      eager: true,
    };
  });
}

function populateGallery(gallery, items, rowCount, { mixFormats = false, mixVideoFormats = false } = {}) {
  if (!items.length || !rowCount) return;
  const minPerRow = Math.max(items.length, rowCount * 6);
  let rowItems;
  if (mixVideoFormats) {
    rowItems = splitVideoRowsBalanced(items, rowCount, minPerRow);
  } else {
    rowItems = splitAcrossRows(expandItems(items, minPerRow), rowCount);
  }
  if (mixFormats) rowItems = assignMixedDisplayFormats(rowItems);
  buildGalleryRows(gallery, rowItems, { alternateDuplicateFormats: mixFormats });
}

function createLightboxController(lightbox, lightboxImg) {
  let savedScrollY = 0;

  function open(src, preserveScrollY) {
    if (!src || !lightbox || !lightboxImg) return;
    savedScrollY = typeof preserveScrollY === 'number' ? preserveScrollY : window.scrollY;
    lightboxImg.setAttribute('src', src);
    lightbox.classList.add('is-open');
    document.body.classList.add('is-lightbox-open');
    document.body.style.top = `-${savedScrollY}px`;
  }

  function close() {
    if (!lightbox?.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('is-lightbox-open');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollY);
  }

  return { open, close };
}

function openGalleryItem(item, handlers, { preserveScrollY } = {}) {
  if (!item) return;
  const type = item.dataset.type;
  if (type === 'web' && item.dataset.url) {
    handlers.onWeb?.(item.dataset.url);
    return;
  }
  if (type === 'video') {
    const url = item.dataset.url
      || (item.dataset.videoId ? `https://www.youtube.com/watch?v=${item.dataset.videoId}` : '');
    if (url) handlers.onVideo?.(url);
    return;
  }
  const img = item.querySelector('img');
  const src = item.dataset.fullSrc || img?.getAttribute('src') || img?.getAttribute('data-src');
  if (src) handlers.onImage?.(src, preserveScrollY);
}

function initGalleries({ openLightbox, closeLightbox }) {
  const handlers = {
    onImage: (src, preserveScrollY) => openLightbox(src, preserveScrollY),
    onWeb: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    onVideo: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  };

  document.querySelectorAll('.pv-gallery').forEach((gallery) => {
    const kind = gallery.dataset.gallery;
    const rowCount = gallery.querySelectorAll('.pv-gallery-row').length;

    if (kind === 'photos' && portfolioImages.photos?.length) {
      populateGallery(gallery, buildPhotoGalleryItems(portfolioImages.photos), rowCount, { mixFormats: true });
    } else if (kind === 'video' && videoProjects.length) {
      populateGallery(gallery, buildVideoGalleryItems(videoProjects), rowCount, { mixVideoFormats: true });
    } else if (kind === 'web' && webProjects.length) {
      populateGallery(gallery, buildWebGalleryItems(webProjects), rowCount);
    } else if (kind === 'design' && portfolioImages.graphisme?.length) {
      populateGallery(gallery, buildDesignGalleryItems(portfolioImages.graphisme), rowCount, { mixFormats: true });
    }

    initGalleryRows(gallery, handlers);
  });

  document.querySelectorAll('.pv-spotlight-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preserveScrollY = window.scrollY;
      const target = btn.dataset.galleryTarget;
      const gallery = document.querySelector(`.pv-gallery[data-gallery="${target}"]`);
      if (!gallery) return;
      const item = pickRandomGalleryItem(gallery);
      if (!item) return;
      openGalleryItem(item, handlers, { preserveScrollY });
    });
  });

  return { closeLightbox };
}

function initTransitionBlocks() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.pv-transition-inner').forEach((inner) => {
    const zone = inner.closest('.pv-transition-zone') || inner;

    if (reducedMotion) {
      inner.classList.add('is-in-view');
      return;
    }

    if (!('IntersectionObserver' in window)) {
      inner.classList.add('is-in-view');
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          inner.classList.remove('is-in-view');
          void inner.offsetWidth;
          inner.classList.add('is-in-view');
          return;
        }
        inner.classList.remove('is-in-view');
      });
    }, { threshold: 0.05, rootMargin: '35% 0px 35% 0px' });

    observer.observe(zone);
  });
}

function init() {
  initTransitionBlocks();

  const photoCarousel = document.querySelector('#motion-photos .pv-carousel-container');
  const videoCarousel = document.querySelector('#motion-video .pv-carousel-container');
  const webCarousel = document.querySelector('#motion-web .pv-carousel-container');
  const designCarousel = document.querySelector('#motion-design .pv-carousel-container');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const { open: openLightbox, close: closeLightbox } = createLightboxController(lightbox, lightboxImg);

  initGalleries({ openLightbox, closeLightbox });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  /* Legacy flat carousels — kept only if markup still present */
  if (photoCarousel && portfolioImages.photos?.length) {
    buildCarouselItems(photoCarousel, preferWebpAssets(portfolioImages.photos), 'image');
  }
  if (videoCarousel && videoProjects.length) {
    buildVideoCarouselItems(videoCarousel, videoProjects);
  }
  if (webCarousel && webProjects.length) {
    buildWebCarouselItems(webCarousel, webProjects);
  }
  if (designCarousel && portfolioImages.graphisme?.length) {
    const graphismeImages = preferWebpAssets(portfolioImages.graphisme);
    buildCarouselItems(designCarousel, graphismeImages, 'image', { eagerCount: graphismeImages.length });
  }

  if (document.querySelector('.pv-carousel-container')) {
    document.querySelectorAll('.pv-portfolio-section').forEach((section) => {
      setupCarouselSectionPreload(section);
    });
  }

  const cursor = document.querySelector('.custom-cursor');

  window.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });


  document.querySelectorAll('.pv-skill-card').forEach((card) => {
    const href = card.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const zoneClass = {
      '#motion-photos': 'camera-mode',
      '#motion-video': 'video-mode',
      '#motion-web': 'web-mode',
      '#motion-design': 'design-mode',
    }[href];
    if (!zoneClass) return;
    card.addEventListener('mouseenter', () => { document.body.className = zoneClass; });
    card.addEventListener('mouseleave', () => { document.body.className = ''; });
  });

  setupCursorZone('.photo-zone', 'camera-mode');
  setupCursorZone('.video-zone', 'video-mode');
  setupCursorZone('.web-zone', 'web-mode');
  setupCursorZone('.design-zone', 'design-mode');

  function setupCursorZone(selector, className) {
    const zone = document.querySelector(selector);
    if (zone) {
      zone.addEventListener('mouseenter', () => { document.body.className = className; });
      zone.addEventListener('mouseleave', () => { document.body.className = ''; });
    }
  }

  function initFlatCarousel(wrap, options = {}) {
    const container = wrap.querySelector('.pv-carousel-container');
    const items = container.querySelectorAll('.pv-carousel-item');
    if (!items.length) return;

    const spinBtn = wrap.closest('.pv-portfolio-section')?.querySelector('.spin-trigger-btn');
    let currentIndex = 0;
    let isSpinning = false;
    let historySeen = [];
    let pointerStartX = 0;
    let hasDragged = false;

    function getActiveItem() {
      const modIndex = ((currentIndex % items.length) + items.length) % items.length;
      return items[modIndex];
    }

    function updateCarousel() {
      const modIndex = ((currentIndex % items.length) + items.length) % items.length;
      items.forEach((item, i) => {
        item.classList.toggle('is-active', i === modIndex);
      });
      preloadCarouselNeighbors(items, modIndex);
      waitForCarouselItem(items[modIndex]);
      if (options.onActiveChange) options.onActiveChange(items, modIndex);
    }

    wrap.addEventListener('pointerdown', (e) => {
      if (isSpinning || e.button !== 0) return;
      pointerStartX = e.clientX;
      hasDragged = false;
      wrap.setPointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointermove', (e) => {
      if (pointerStartX === 0) return;
      if (Math.abs(e.clientX - pointerStartX) > 8) hasDragged = true;
    });

    wrap.addEventListener('pointerup', (e) => {
      if (isSpinning || pointerStartX === 0) return;
      const deltaX = e.clientX - pointerStartX;
      if (hasDragged) {
        if (deltaX > 40) currentIndex--;
        else if (deltaX < -40) currentIndex++;
        updateCarousel();
      } else if (options.onTap) {
        options.onTap(getActiveItem());
      }
      pointerStartX = 0;
      hasDragged = false;
      wrap.releasePointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointercancel', () => {
      pointerStartX = 0;
      hasDragged = false;
    });

    function pauseVideoPreviews() {
      items.forEach((item) => {
        const media = item.querySelector('.pv-video-media');
        if (!media) return;
        const iframe = media.querySelector('iframe');
        const thumb = media.querySelector('.pv-video-thumb');
        if (iframe) iframe.remove();
        if (thumb) thumb.classList.remove('is-hidden');
      });
    }

    async function spinCarouselAleatoire() {
      if (isSpinning) return;
      isSpinning = true;
      wrap.classList.add('is-shuffling');

      let pools = [];
      items.forEach((_, i) => { if (!historySeen.includes(i)) pools.push(i); });
      if (pools.length === 0) {
        historySeen = [];
        items.forEach((_, i) => pools.push(i));
      }

      const fromIndex = ((currentIndex % items.length) + items.length) % items.length;
      let targetIndex = pools[Math.floor(Math.random() * pools.length)];
      if (targetIndex === fromIndex && pools.length > 1) {
        targetIndex = pools.find((i) => i !== fromIndex) ?? targetIndex;
      }
      historySeen.push(targetIndex);

      const sequence = pickShuffleSequence(items.length, fromIndex, targetIndex);
      const flying = new Set(sequence);
      sequence.forEach((index) => ensureCarouselImage(items[index]));
      ensureCarouselImage(items[fromIndex]);
      pauseVideoPreviews();

      const front = items[fromIndex];
      const deckCards = [];

      try {
        front.classList.add('is-shuffle-front');

        for (let i = 0; i < items.length && deckCards.length < 2; i += 1) {
          if (i === fromIndex || flying.has(i)) continue;
          items[i].classList.add(`is-deck-${deckCards.length + 1}`);
          ensureCarouselImage(items[i]);
          deckCards.push(items[i]);
        }

        const stepMs = 90;
        for (let s = 0; s < sequence.length; s += 1) {
          const item = items[sequence[s]];
          const isLast = s === sequence.length - 1;
          item.classList.add('is-shuffle-card', isLast ? 'is-riffle-land' : (s % 2 === 0 ? 'is-riffle-right' : 'is-riffle-left'));
          await wait(isLast ? 280 : stepMs);
          if (!isLast) {
            item.classList.remove('is-shuffle-card', 'is-riffle-left', 'is-riffle-right');
          }
        }

        currentIndex = targetIndex;
        updateCarousel();
      } finally {
        front.classList.remove('is-shuffle-front');
        deckCards.forEach((card, index) => card.classList.remove(`is-deck-${index + 1}`));
        items[targetIndex].classList.remove('is-shuffle-card', 'is-riffle-land', 'is-riffle-left', 'is-riffle-right');
        wrap.classList.remove('is-shuffling');
        isSpinning = false;
      }
    }

    if (spinBtn) spinBtn.addEventListener('click', spinCarouselAleatoire);
    container.spinFunction = spinCarouselAleatoire;
    updateCarousel();
  }

  function initCarousel3D(wrap) {
    const container = wrap.querySelector('.pv-carousel-container');
    const items = container.querySelectorAll('.pv-carousel-item');
    if (!items.length) return;

    const spinBtn = wrap.closest('.pv-portfolio-section')?.querySelector('.spin-trigger-btn');
    const radius = 420;
    let currentIndex = 0;
    let isSpinning = false;
    let startX = 0;
    let historySeen = [];
    const angleStep = 360 / items.length;

    items.forEach((item, i) => {
      const angle = i * angleStep;
      item.style.transform = `rotateY(${angle}deg) translateZ(${radius}px)`;
    });

    function updateCarousel() {
      const angle = currentIndex * -angleStep;
      container.style.transform = `rotateY(${angle}deg)`;
      const modIndex = ((currentIndex % items.length) + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle('is-active', i === modIndex));
    }

    const onDragStart = (clientX) => { if (!isSpinning) startX = clientX; };
    const onDragEnd = (clientX) => {
      if (isSpinning || startX === 0) return;
      const deltaX = clientX - startX;
      if (deltaX > 40) currentIndex--;
      else if (deltaX < -40) currentIndex++;
      startX = 0;
      updateCarousel();
    };

    wrap.addEventListener('mousedown', (e) => onDragStart(e.clientX));
    wrap.addEventListener('mouseup', (e) => onDragEnd(e.clientX));
    wrap.addEventListener('mouseleave', () => { startX = 0; });
    wrap.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX), { passive: true });
    wrap.addEventListener('touchend', (e) => onDragEnd(e.changedTouches[0].clientX));

    function spinCarouselAleatoire() {
      if (isSpinning) return;
      isSpinning = true;

      let pools = [];
      items.forEach((_, i) => { if (!historySeen.includes(i)) pools.push(i); });
      if (pools.length === 0) {
        historySeen = [];
        items.forEach((_, i) => pools.push(i));
      }

      const randomIndex = pools[Math.floor(Math.random() * pools.length)];
      historySeen.push(randomIndex);
      currentIndex = currentIndex + (4 * items.length) + (randomIndex - (currentIndex % items.length));

      container.style.transition = 'transform 3.5s cubic-bezier(0.05, 0.9, 0.1, 1)';
      updateCarousel();

      setTimeout(() => {
        container.style.transition = 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
        isSpinning = false;
      }, 3500);
    }

    if (spinBtn) spinBtn.addEventListener('click', spinCarouselAleatoire);
    container.spinFunction = spinCarouselAleatoire;
    updateCarousel();
  }

  if (document.querySelector('.pv-carousel-flat')) {
    const onCarouselTap = (item) => handleCarouselTap(item, openLightbox);
    document.querySelectorAll('.pv-carousel-flat:not(.pv-carousel-video)').forEach((wrap) => {
      initFlatCarousel(wrap, { onTap: onCarouselTap });
    });
    document.querySelectorAll('.pv-carousel-video').forEach((wrap) => {
      initFlatCarousel(wrap, { onActiveChange: setActiveVideoPreview });
    });
  }
  document.querySelectorAll('.pv-carousel-3d').forEach(initCarousel3D);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
