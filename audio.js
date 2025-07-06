// audio.js

const audioList = [
  'Elevator Music.mp3',
  'The Great Strategy (2005) Roblox Theme 2006.mp3',
  'Sonic The Hedgehog OST - Green Hill Zone.mp3',
  'ROBLOX runaway.mp3',
  'Mii Editor - Mii Maker (Wii U) Music [ ezmp3.cc ].mp3',
  'omfg low quality.mp3',
  'Raise_A_Floppa_Soundtrack_[_YouConvert.net_].mp3',
  'Special Stage - Sonic the Hedgehog 3 [OST] - DeoxysPrime.mp3',
  'Super Mario 64 - Main Theme Music - Bob-Omb Battlefield [TubeRipper.com].mp3',
  'Coconut Mall - Mario Kart Wii OST.mp3',
  'Burger King Whopper Whopper Whopper Commercial But Its Low Quality.mp3',
  'c418-sweden-minecraft-volume-alpha.mp3',
  'Super Mario 64 Music - File Select EXTENDED.mp3',
  '02. Wasted Years.mp3',
].map(src => encodeURI(src));

let currentTrackIndex = 0;
const audio = new Audio();
audio.src = audioList[0];
audio.loop = false;
let isMusicUserPaused = false;

audio.addEventListener('ended', () => {
  currentTrackIndex = (currentTrackIndex + 1) % audioList.length;
  audio.src = audioList[currentTrackIndex];
  if (!isMusicUserPaused) {
    audio.play().catch(err => console.warn("Audio play failed on next track:", err));
  }
});

const fluorescentBuzzAudio = new Audio(encodeURI('Fluorescent light Buzz.mp3'));
fluorescentBuzzAudio.loop = true;
fluorescentBuzzAudio.volume = 0.5;

const toggleAudio = () => {
  if (audio.paused) {
    audio.play().catch(err => console.warn("Audio play failed on toggle:", err));
    isMusicUserPaused = false;
  } else {
    audio.pause();
    isMusicUserPaused = true;
  }
};

const skipAudio = () => {
  if (audioList.length > 0) {
    currentTrackIndex = (currentTrackIndex + 1) % audioList.length;
    audio.src = audioList[currentTrackIndex];
    audio.play().catch(err => console.warn("Audio play failed on skip:", err));
    isMusicUserPaused = false;
  }
};

const attemptPlayAudio = () => {
  console.log("Attempting to play audio due to user interaction.");
  if (!isMusicUserPaused && audio.paused && fluorescentBuzzAudio.paused) {
    audio.play().catch(err => console.warn("Audio play failed:", err));
  } else if (fluorescentBuzzAudio.paused) {
    // No explicit action needed if main audio is playing or user paused.
    // The point of this function is to kickstart audio if user interaction allows it.
  }
};

// Make functions globally accessible if needed, e.g., by attaching to window
window.toggleAudio = toggleAudio;
window.skipAudio = skipAudio;
window.attemptPlayAudio = attemptPlayAudio;
window.isMusicUserPaused = isMusicUserPaused; // Expose the state if needed
window.audio = audio; // Expose audio objects for direct manipulation if necessary
window.fluorescentBuzzAudio = fluorescentBuzzAudio;
