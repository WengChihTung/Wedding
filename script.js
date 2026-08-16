const pages = [...document.querySelectorAll('.page')]
  .sort((a, b) => Number(a.dataset.page) - Number(b.dataset.page));
const current = document.getElementById('page-current');
const total = document.getElementById('page-total');
const progress = document.getElementById('progress-bar');
const pager = document.getElementById('pager');
const progressWrap = document.getElementById('progress');
const envelope = document.getElementById('open-envelope');
const video = document.getElementById('video');
const player = document.getElementById('player');
const filmCopy = document.getElementById('film-copy');
const bgm = document.getElementById('bgm');
const musicControl = document.getElementById('music-control');
const pagerPrevious = pager.querySelector('[data-prev]');
const pagerNext = pager.querySelector('[data-next]');
let activePage = 0;
let wheelLocked = false;
let touchStartY = 0;
let transitionTimer;
let envelopeTimer;
let envelopeOpening = false;
let activeImageLoads = 0;
let musicStartedOnce = false;
let resumeMusicAfterVideo = false;
const imageQueue = [];
const queuedImages = new WeakSet();

const sleep = delay => new Promise(resolve => window.setTimeout(resolve, delay));

function markImageReady(image) {
  image.classList.add('is-loaded');
}

function prepareImage(image, priority = 'low') {
  if (!image) return Promise.resolve();
  image.loading = 'eager';
  image.fetchPriority = priority;
  const decodeAndReveal = () => {
    const decoded = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
    return decoded.then(() => markImageReady(image));
  };
  if (image.complete) {
    return decodeAndReveal();
  }
  return new Promise(resolve => {
    const finish = async () => {
      await decodeAndReveal();
      resolve();
    };
    const fail = () => {
      markImageReady(image);
      resolve();
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', fail, { once: true });
  });
}

function runImageQueue() {
  imageQueue.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));
  while (activeImageLoads < 2 && imageQueue.length) {
    const { image, priority } = imageQueue.shift();
    activeImageLoads += 1;
    prepareImage(image, priority).finally(() => {
      activeImageLoads -= 1;
      runImageQueue();
    });
  }
}

function queueImage(image, priority) {
  if (queuedImages.has(image)) {
    const queued = imageQueue.find(item => item.image === image);
    if (queued && priority === 'high') queued.priority = 'high';
    runImageQueue();
    return;
  }
  queuedImages.add(image);
  imageQueue.push({ image, priority });
  runImageQueue();
}

function warmNearbyPages(index) {
  pages.slice(index, index + 3).forEach((page, pageOffset) => {
    page.querySelectorAll('img[loading]').forEach(image => {
      queueImage(image, pageOffset === 0 ? 'high' : 'low');
    });
  });
}

function preloadCover() {
  return new Promise(resolve => {
    const cover = new Image();
    const finish = async () => {
      if (cover.decode) await cover.decode().catch(() => {});
      resolve();
    };
    cover.onload = finish;
    cover.onerror = resolve;
    cover.src = 'assets/images/optimized/cover.jpg';
    if (cover.complete) finish();
  });
}

async function revealInvitation() {
  const fontReady = document.fonts
    ? document.fonts.load('1em "ChenYuluoyan"').catch(() => {})
    : Promise.resolve();
  await Promise.race([
    Promise.all([fontReady, preloadCover(), sleep(420)]),
    sleep(5500)
  ]);
  document.documentElement.classList.remove('is-loading');
  document.getElementById('site-loader').setAttribute('aria-hidden', 'true');
  warmNearbyPages(0);
}

document.querySelectorAll('img[loading]').forEach(image => {
  const revealAfterDecode = async () => {
    if (image.decode) await image.decode().catch(() => {});
    markImageReady(image);
  };
  if (image.complete) revealAfterDecode();
  image.addEventListener('load', revealAfterDecode, { once: true });
  image.addEventListener('error', () => markImageReady(image), { once: true });
});

revealInvitation();

total.textContent = String(pages.length).padStart(2, '0');

function showPage(index) {
  const next = Math.max(0, Math.min(index, pages.length - 1));
  if (next === activePage) return;
  const direction = next > activePage ? 1 : -1;
  const previousPage = pages[activePage];
  const nextPage = pages[next];
  window.clearTimeout(transitionTimer);
  pages.forEach(page => page.classList.remove('is-leaving-up', 'is-leaving-down', 'enter-from-top'));
  previousPage.classList.add(direction > 0 ? 'is-leaving-up' : 'is-leaving-down');
  previousPage.classList.remove('is-active');
  if (previousPage.classList.contains('page--film')) closeVideo();
  activePage = next;
  if (activePage === 0) {
    window.clearTimeout(envelopeTimer);
    envelopeOpening = false;
    envelope.classList.remove('open');
    envelope.setAttribute('aria-expanded', 'false');
  }
  if (direction < 0) nextPage.classList.add('enter-from-top');
  void nextPage.offsetWidth;
  nextPage.classList.add('is-active');
  nextPage.classList.remove('enter-from-top');
  current.textContent = String(activePage + 1).padStart(2, '0');
  progress.style.width = `${((activePage + 1) / pages.length) * 100}%`;
  pagerPrevious.disabled = activePage === 0;
  pagerNext.disabled = activePage === pages.length - 1;
  warmNearbyPages(activePage);
  transitionTimer = window.setTimeout(() => {
    previousPage.classList.remove('is-leaving-up', 'is-leaving-down');
  }, 920);
}

function openInvitation() {
  if (!musicStartedOnce) playBackgroundMusic();
  if (envelopeOpening) return;
  if (envelope.classList.contains('open')) {
    pager.hidden = false;
    progressWrap.hidden = false;
    showPage(1);
    return;
  }
  envelopeOpening = true;
  envelope.classList.add('open');
  envelope.setAttribute('aria-expanded', 'true');
  envelopeTimer = window.setTimeout(() => {
    envelopeOpening = false;
    pager.hidden = false;
    progressWrap.hidden = false;
    showPage(1);
  }, 1650);
}

function move(direction) {
  if (activePage === 0 && direction > 0) return openInvitation();
  showPage(activePage + direction);
}

envelope.addEventListener('click', openInvitation);
document.getElementById('open-hint').addEventListener('click', openInvitation);
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => move(1)));
document.querySelectorAll('[data-prev]').forEach(button => button.addEventListener('click', () => move(-1)));

window.addEventListener('wheel', event => {
  event.preventDefault();
  if (wheelLocked || Math.abs(event.deltaY) < 30 || player.hidden === false) return;
  wheelLocked = true;
  move(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 620);
}, { passive: false });

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeVideo();
  if (player.hidden === false) return;
  if (['ArrowDown', 'PageDown', ' '].includes(event.key)) move(1);
  if (['ArrowUp', 'PageUp'].includes(event.key)) move(-1);
});

window.addEventListener('touchstart', event => {
  touchStartY = event.changedTouches[0].screenY;
}, { passive: true });
window.addEventListener('touchend', event => {
  if (player.hidden === false) return;
  const distance = touchStartY - event.changedTouches[0].screenY;
  if (Math.abs(distance) > 48) move(distance > 0 ? 1 : -1);
}, { passive: true });

const weddingTime = new Date('2026-09-12T10:00:00+08:00').getTime();
function updateCountdown() {
  const distance = weddingTime - Date.now();
  if (distance <= 0) {
    document.getElementById('countdown').hidden = true;
    document.getElementById('countdown-finished').hidden = false;
    return;
  }
  document.getElementById('days').textContent = Math.floor(distance / 86400000);
  document.getElementById('hours').textContent = String(Math.floor(distance / 3600000) % 24).padStart(2, '0');
  document.getElementById('minutes').textContent = String(Math.floor(distance / 60000) % 60).padStart(2, '0');
  document.getElementById('seconds').textContent = String(Math.floor(distance / 1000) % 60).padStart(2, '0');
}
updateCountdown();
window.setInterval(updateCountdown, 1000);

function closeVideo() {
  const shouldResumeMusic = resumeMusicAfterVideo;
  resumeMusicAfterVideo = false;
  video.pause();
  player.hidden = true;
  filmCopy.hidden = false;
  musicControl.disabled = false;
  if (shouldResumeMusic) playBackgroundMusic();
}

document.getElementById('play').addEventListener('click', () => {
  resumeMusicAfterVideo = !bgm.paused;
  bgm.pause();
  updateMusicControl(false);
  musicControl.disabled = true;
  filmCopy.hidden = true;
  player.hidden = false;
  video.play().catch(closeVideo);
});
document.getElementById('close-video').addEventListener('click', closeVideo);
video.addEventListener('ended', closeVideo);

function updateMusicControl(isPlaying) {
  musicControl.classList.toggle('playing', isPlaying);
  musicControl.setAttribute('aria-pressed', String(isPlaying));
  musicControl.setAttribute('aria-label', isPlaying ? '暫停背景音樂' : '播放背景音樂');
}

function playBackgroundMusic() {
  return bgm.play().then(() => {
    musicStartedOnce = true;
    updateMusicControl(true);
  }).catch(() => {
    updateMusicControl(false);
  });
}

bgm.volume = .42;
bgm.addEventListener('play', () => updateMusicControl(true));
bgm.addEventListener('pause', () => updateMusicControl(false));

musicControl.addEventListener('click', () => {
  if (musicControl.disabled) return;
  if (bgm.paused) {
    playBackgroundMusic();
  } else {
    bgm.pause();
  }
});
