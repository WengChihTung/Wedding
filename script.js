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
const loaderStatus = document.getElementById('loader-status');
const pagerPrevious = pager.querySelector('[data-prev]');
const pagerNext = pager.querySelector('[data-next]');
const PAGE_TRANSITION_MS = 920;
const PAGE_INPUT_LOCK_MS = 280;
const ENVELOPE_OPEN_MS = 1650;
const WHEEL_IDLE_RESET_MS = 360;
const WHEEL_TRIGGER_DISTANCE = 18;
const contentPageCount = pages.length - 1;
let activePage = 0;
let navigationLockedUntil = 0;
let wheelDeltaY = 0;
let wheelGestureHandled = false;
let wheelResetTimer;
let touchTracking = false;
let touchStartY = 0;
let transitionTimer;
let envelopeTimer;
let envelopeOpening = false;
let musicStartedOnce = false;
let musicStartPromise = null;
let resumeMusicAfterVideo = false;
let videoPreloadRequested = false;

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
  const siteImages = [...document.querySelectorAll('img[loading]')];
  const totalImages = siteImages.length + 1;
  let completedImages = 0;
  const trackImage = promise => promise.finally(() => {
    completedImages += 1;
    loaderStatus.textContent = `正在準備照片 ${completedImages}/${totalImages}`;
  });
  loaderStatus.textContent = `正在準備照片 0/${totalImages}`;
  await Promise.all([
    fontReady,
    sleep(420),
    trackImage(preloadCover()),
    ...siteImages.map(image => trackImage(prepareImage(image, 'high')))
  ]);
  document.documentElement.classList.remove('is-loading');
  document.getElementById('site-loader').setAttribute('aria-hidden', 'true');
  window.setTimeout(startVideoPreload, 0);
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
  lockNavigation(PAGE_INPUT_LOCK_MS);
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
    showPage(1, { ignoreLock: true });
  }, ENVELOPE_OPEN_MS);
  return true;
}

function move(direction) {
  if (isNavigationLocked()) return false;
  if (activePage === 0 && direction > 0) return openInvitation();
  return showPage(activePage + direction);
}

function moveFromControl(direction) {
  return move(direction);
}

function openInvitationFromControl() {
  return openInvitation();
}

envelope.addEventListener('click', openInvitationFromControl);
document.getElementById('open-hint').addEventListener('click', openInvitationFromControl);
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => moveFromControl(1)));
document.querySelectorAll('[data-prev]').forEach(button => button.addEventListener('click', () => moveFromControl(-1)));

function handleWheelNavigation(event) {
  if (event.cancelable) event.preventDefault();
  if (player.hidden === false) return;
  const deltaScale = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2 ? window.innerHeight : 1;
  const rawDeltaY = Number.isFinite(event.deltaY) && event.deltaY !== 0
    ? event.deltaY * deltaScale
    : -(event.wheelDelta || 0);
  if (rawDeltaY === 0) return;
  window.clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelDeltaY = 0;
    wheelGestureHandled = false;
  }, WHEEL_IDLE_RESET_MS);
  if (wheelGestureHandled) return;
  if (wheelDeltaY !== 0 && Math.sign(rawDeltaY) !== Math.sign(wheelDeltaY)) wheelDeltaY = 0;
  wheelDeltaY += rawDeltaY;
  if (Math.abs(wheelDeltaY) < WHEEL_TRIGGER_DISTANCE) return;
  const direction = wheelDeltaY > 0 ? 1 : -1;
  wheelDeltaY = 0;
  wheelGestureHandled = true;
  if (!isNavigationLocked()) move(direction);
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

function startVideoPreload() {
  if (videoPreloadRequested) return;
  videoPreloadRequested = true;
  video.preload = 'auto';
  video.load();
}

function requestVideoPlayback({ reload = false } = {}) {
  video.preload = 'auto';
  if (reload || video.readyState === 0) video.load();
  setVideoStatus(video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? '' : '影片載入中…');
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
video.addEventListener('timeupdate', () => {
  if (player.hidden === false && !video.paused) setVideoStatus('');
});
video.addEventListener('waiting', () => {
  if (player.hidden === false) setVideoStatus('影片載入中…');
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
