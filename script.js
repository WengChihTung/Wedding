const playButton = document.getElementById('play');
const player = document.getElementById('player');
const video = document.getElementById('video');

playButton.addEventListener('click', () => {
  player.classList.remove('hidden');
  video.play();
});
document.querySelectorAll('.panel').forEach((p,i)=>{p.animate([{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,delay:i*120,fill:'both'});});
