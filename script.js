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
const videoStatus = document.getElementById('video-status');
const videoStatusText = document.getElementById('video-status-text');
const retryVideo = document.getElementById('retry-video');
const bgm = document.getElementById('bgm');
const musicControl = document.getElementById('music-control');
const pagerPrevious = pager.querySelector('[data-prev]');
const pagerNext = pager.querySelector('[data-next]');
const groomImage = pages.find(page => page.dataset.page === '3')?.querySelector('img');
const PAGE_TRANSITION_MS = 920;
const ENVELOPE_OPEN_MS = 1650;
const WHEEL_IDLE_RESET_MS = 220;
const WHEEL_TRIGGER_DISTANCE = 20;
const contentPageCount = pages.length - 1;
let activePage = 0;
let navigationLockedUntil = 0;
let wheelDeltaY = 0;
let lastWheelAt = 0;
let wheelGestureHandled = false;
let pendingWheelDirection = 0;
let pendingWheelTimer;
let touchTracking = false;
let touchStartY = 0;
let transitionTimer;
let envelopeTimer;
let envelopeOpening = false;
let activeImageLoads = 0;
let musicStartedOnce = false;
let musicStartPromise = null;
let resumeMusicAfterVideo = false;
let videoWarmStage = 0;
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
  if (groomImage) queuedImages.add(groomImage);
  const groomReady = prepareImage(groomImage, 'high');
  await Promise.race([
    Promise.all([fontReady, preloadCover(), groomReady, sleep(420)]),
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

total.textContent = String(contentPageCount).padStart(2, '0');

function isNavigationLocked() {
  return performance.now() < navigationLockedUntil;
}

function lockNavigation(duration) {
  navigationLockedUntil = performance.now() + duration;
}

function showPage(index, { ignoreLock = false } = {}) {
  if (isNavigationLocked() && !ignoreLock) return false;
  const next = Math.max(0, Math.min(index, pages.length - 1));
  if (next === activePage) return false;
  lockNavigation(PAGE_TRANSITION_MS);
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
    pager.hidden = true;
    progressWrap.hidden = true;
  }
  if (direction < 0) nextPage.classList.add('enter-from-top');
  void nextPage.offsetWidth;
  nextPage.classList.add('is-active');
  nextPage.classList.remove('enter-from-top');
  current.textContent = String(Math.max(activePage, 1)).padStart(2, '0');
  progress.style.width = `${(Math.max(activePage, 1) / contentPageCount) * 100}%`;
  pagerPrevious.disabled = activePage === 0;
  pagerNext.disabled = activePage === pages.length - 1;
  warmNearbyPages(activePage);
  if (activePage >= 4) scheduleVideoWarmup(nextPage);
  transitionTimer = window.setTimeout(() => {
    previousPage.classList.remove('is-leaving-up', 'is-leaving-down');
  }, PAGE_TRANSITION_MS);
  return true;
}

function openInvitation() {
  if (!musicStartedOnce) playBackgroundMusic();
  if (envelopeOpening || isNavigationLocked()) return false;
  if (envelope.classList.contains('open')) {
    pager.hidden = false;
    progressWrap.hidden = false;
    warmVideo(1);
    return showPage(1);
  }
  envelopeOpening = true;
  lockNavigation(ENVELOPE_OPEN_MS);
  envelope.classList.add('open');
  envelope.setAttribute('aria-expanded', 'true');
  envelopeTimer = window.setTimeout(() => {
    envelopeOpening = false;
    pager.hidden = false;
    progressWrap.hidden = false;
    warmVideo(1);
    showPage(1, { ignoreLock: true });
  }, ENVELOPE_OPEN_MS);
  return true;
}

function move(direction) {
  if (isNavigationLocked()) return false;
  if (activePage === 0 && direction > 0) return openInvitation();
  return showPage(activePage + direction);
}

function cancelPendingWheelNavigation() {
  pendingWheelDirection = 0;
  window.clearTimeout(pendingWheelTimer);
}

function schedulePendingWheelNavigation() {
  window.clearTimeout(pendingWheelTimer);
  if (pendingWheelDirection === 0) return;
  const delay = Math.max(navigationLockedUntil - performance.now(), 0) + 24;
  pendingWheelTimer = window.setTimeout(() => {
    if (isNavigationLocked()) {
      schedulePendingWheelNavigation();
      return;
    }
    const direction = pendingWheelDirection;
    pendingWheelDirection = 0;
    move(direction);
  }, delay);
}

function moveFromControl(direction) {
  cancelPendingWheelNavigation();
  return move(direction);
}

function openInvitationFromControl() {
  cancelPendingWheelNavigation();
  return openInvitation();
}

envelope.addEventListener('click', openInvitationFromControl);
document.getElementById('open-hint').addEventListener('click', openInvitationFromControl);
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => moveFromControl(1)));
document.querySelectorAll('[data-prev]').forEach(button => button.addEventListener('click', () => moveFromControl(-1)));

function handleWheelNavigation(event) {
  if (event.cancelable) event.preventDefault();
  if (player.hidden === false) return;
  const now = performance.now();
  if (now - lastWheelAt > WHEEL_IDLE_RESET_MS) {
    wheelDeltaY = 0;
    wheelGestureHandled = false;
  }
  lastWheelAt = now;
  const deltaScale = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2 ? window.innerHeight : 1;
  const rawDeltaY = Number.isFinite(event.deltaY) && event.deltaY !== 0
    ? event.deltaY * deltaScale
    : -(event.wheelDelta || 0);
  if (rawDeltaY === 0) return;
  if (wheelGestureHandled) return;
  if (wheelDeltaY !== 0 && Math.sign(rawDeltaY) !== Math.sign(wheelDeltaY)) wheelDeltaY = 0;
  wheelDeltaY += rawDeltaY;
  if (Math.abs(wheelDeltaY) < WHEEL_TRIGGER_DISTANCE) return;
  const direction = wheelDeltaY > 0 ? 1 : -1;
  wheelDeltaY = 0;
  if (isNavigationLocked()) {
    wheelGestureHandled = true;
    pendingWheelDirection = direction;
    schedulePendingWheelNavigation();
    return;
  }
  cancelPendingWheelNavigation();
  wheelGestureHandled = move(direction) === true;
}

window.addEventListener('wheel', handleWheelNavigation, { passive: false, capture: true });
window.addEventListener('mousewheel', handleWheelNavigation, { passive: false, capture: true });

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && player.hidden === false) {
    event.preventDefault();
    closeVideo();
    return;
  }
  if (player.hidden === false) return;
  const target = event.target;
  const isInteractive = target instanceof Element && target.closest('button,a,input,textarea,select,video,audio,[contenteditable="true"]');
  if (isInteractive || event.repeat) return;
  if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    moveFromControl(1);
  }
  if (['ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    moveFromControl(-1);
  }
});

window.addEventListener('touchstart', event => {
  touchTracking = !isNavigationLocked() && player.hidden !== false;
  touchStartY = event.changedTouches[0].screenY;
  if (touchTracking && activePage === 0 && !musicStartedOnce && bgm.readyState === HTMLMediaElement.HAVE_NOTHING) {
    bgm.load();
  }
}, { passive: true });
window.addEventListener('touchend', event => {
  if (!touchTracking) return;
  touchTracking = false;
  if (isNavigationLocked() || player.hidden === false) return;
  const distance = touchStartY - event.changedTouches[0].screenY;
  if (Math.abs(distance) > 48) {
    if (activePage === 0 && distance > 0 && !musicStartedOnce) playBackgroundMusic();
    moveFromControl(distance > 0 ? 1 : -1);
  }
}, { passive: true });
window.addEventListener('touchcancel', () => {
  touchTracking = false;
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
  setVideoStatus('');
  player.hidden = true;
  filmCopy.hidden = false;
  musicControl.disabled = false;
  if (shouldResumeMusic) playBackgroundMusic();
}

function setVideoStatus(message, canRetry = false) {
  videoStatusText.textContent = message;
  videoStatus.hidden = message === '';
  retryVideo.hidden = !canRetry;
}

function warmVideo(stage) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const shouldLimitPreload = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType);
  const nextStage = stage > 1 && !shouldLimitPreload ? 2 : 1;
  if (videoWarmStage >= nextStage) return;
  videoWarmStage = nextStage;
  video.preload = nextStage === 2 ? 'auto' : 'metadata';
  video.load();
}

function scheduleVideoWarmup(page) {
  if (videoWarmStage >= 2) return;
  const pageImages = [...page.querySelectorAll('img[loading]')];
  const currentImagesReady = Promise.all(pageImages.map(image => prepareImage(image, 'high')));
  Promise.race([currentImagesReady, sleep(1400)]).then(() => {
    if (activePage >= 4) warmVideo(2);
  });
}

function requestVideoPlayback({ reload = false } = {}) {
  video.preload = 'auto';
  videoWarmStage = 2;
  if (reload || video.readyState === 0) video.load();
  setVideoStatus('影片載入中…');
  return video.play().catch(() => {
    if (player.hidden === false) setVideoStatus('影片暫時無法播放', true);
  });
}

document.getElementById('play').addEventListener('click', () => {
  resumeMusicAfterVideo = !bgm.paused;
  bgm.pause();
  updateMusicControl(false);
  musicControl.disabled = true;
  filmCopy.hidden = true;
  player.hidden = false;
  requestVideoPlayback();
});
document.getElementById('close-video').addEventListener('click', closeVideo);
retryVideo.addEventListener('click', () => requestVideoPlayback({ reload: true }));
video.addEventListener('canplay', () => setVideoStatus(''));
video.addEventListener('playing', () => setVideoStatus(''));
video.addEventListener('waiting', () => {
  if (player.hidden === false) setVideoStatus('影片載入中…');
});
video.addEventListener('stalled', () => {
  if (player.hidden === false) setVideoStatus('網路較慢，影片仍在載入…');
});
video.addEventListener('error', () => {
  if (player.hidden === false) setVideoStatus('影片載入失敗', true);
});
video.addEventListener('ended', closeVideo);

function updateMusicControl(isPlaying) {
  musicControl.classList.toggle('playing', isPlaying);
  musicControl.setAttribute('aria-pressed', String(isPlaying));
  musicControl.setAttribute('aria-label', isPlaying ? '暫停背景音樂' : '播放背景音樂');
}

function playBackgroundMusic() {
  if (musicStartPromise) return musicStartPromise;
  musicStartPromise = bgm.play().then(() => {
    musicStartedOnce = true;
    updateMusicControl(true);
  }).catch(() => {
    updateMusicControl(false);
  }).finally(() => {
    musicStartPromise = null;
  });
  return musicStartPromise;
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
