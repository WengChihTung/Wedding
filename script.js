
document.getElementById("play").addEventListener("click",()=>{
const box=document.getElementById("player");
const video=document.getElementById("video");
box.classList.remove("hidden");
video.play();
box.scrollIntoView({behavior:"smooth"});
});
