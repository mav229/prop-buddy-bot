// Sleek, modern UI sound effects
// Using short, subtle sounds that feel premium and unobtrusive

const SOUNDS = {
  // Soft whoosh for opening launcher/panels
  open: "https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3",
  // Subtle notification chime
  notification: "https://cdn.freesound.org/previews/536/536420_11943129-lq.mp3",
  // Simple pop for sending messages
  send: "https://cdn.freesound.org/previews/554/554053_9497060-lq.mp3",
  // Gentle receive sound
  receive: "https://cdn.freesound.org/previews/351/351565_5121236-lq.mp3",
  // Code/typing sound
  code: "https://cdn.freesound.org/previews/256/256116_3263906-lq.mp3",
} as const;

type SoundType = keyof typeof SOUNDS;

// Cache audio instances for faster playback
const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {};

// Preload sounds for instant playback
const preloadSound = (type: SoundType): HTMLAudioElement => {
  if (!audioCache[type]) {
    const audio = new Audio(SOUNDS[type]);
    audio.preload = "auto";
    audio.volume = 0;
    audioCache[type] = audio;
  }
  return audioCache[type]!;
};

// Play sound with smooth fade-in
export const playSound = (type: SoundType, volume: number = 0.15): void => {
  try {
    // Create new audio instance for overlapping sounds
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0;
    
    audio.play().then(() => {
      // Smooth fade-in over 100ms
      let vol = 0;
      const targetVol = Math.min(volume, 0.3); // Cap at 30% volume
      const fadeIn = setInterval(() => {
        vol = Math.min(vol + 0.02, targetVol);
        audio.volume = vol;
        if (vol >= targetVol) clearInterval(fadeIn);
      }, 8);
    }).catch(() => {
      // Silently fail - user may not have interacted yet
    });
  } catch {
    // Silently fail
  }
};

// Preload all sounds on first interaction
let preloaded = false;
export const preloadAllSounds = (): void => {
  if (preloaded) return;
  preloaded = true;
  Object.keys(SOUNDS).forEach((key) => preloadSound(key as SoundType));
};

export const useSounds = () => {
  return {
    playOpen: () => playSound("open", 0.12),
    playNotification: () => playSound("notification", 0.1),
    playSend: () => playSound("send", 0.08),
    playReceive: () => playSound("receive", 0.1),
    playCode: () => playSound("code", 0.06),
    preload: preloadAllSounds,
  };
};
