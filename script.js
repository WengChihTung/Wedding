const pages = [...document.querySelectorAll('.page')];
const current = document.getElementById('page-current');
const total = document.getElementById('page-total');
const progress = document.getElementById('progress-bar');
const player = document.getElementById('player');
const video = document.getElementById('video');
let activePage = 0;
let wheelLocked = false;

total.textContent = String(pages.length).padStart(2, '0');

function showPage(index) {
  const next = Math.max(0, Math.min(index, pages.length - 1));
  if (next === activePage) return;
  pages[activePage].classList.remove('is-active');
  activePage = next;
  pages[activePage].classList.add('is-active');
  current.textContent = String(activePage + 1).padStart(2, '0');
  progress.style.width = `${((activePage + 1) / pages.length) * 100}%`;
}

function move(direction) { showPage(activePage + direction); }
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => move(1)));
document.querySelectorAll('[data-prev]').forEach(button => button.addEventListener('click', () => move(-1)));

window.addEventListener('wheel', event => {
  if (wheelLocked || Math.abs(event.deltaY) < 20) return;
  wheelLocked = true;
  move(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 700);
}, { passive: true });

window.addEventListener('keydown', event => {
  if (['ArrowDown', 'PageDown', ' '].includes(event.key)) move(1);
  if (['ArrowUp', 'PageUp'].includes(event.key)) move(-1);
});

let touchStartY = 0;
window.addEventListener('touchstart', event => { touchStartY = event.changedTouches[0].screenY; }, { passive: true });
window.addEventListener('touchend', event => {
  const distance = touchStartY - event.changedTouches[0].screenY;
  if (Math.abs(distance) > 45) move(distance > 0 ? 1 : -1);
}, { passive: true });

document.getElementById('play').addEventListener('click', () => {
  player.hidden = false;
  video.play().catch(() => {});
});
