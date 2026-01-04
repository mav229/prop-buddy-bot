// Sleek, modern UI sound effects
// Using short, subtle sounds that feel premium and unobtrusive

const SOUNDS = {
  // Soft pop for opening panels/modals
  open: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  // Subtle notification for popups
  notification: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
  // Light click for sending messages
  send: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
  // Gentle chime for receiving messages
  receive: "https://assets.mixkit.co/active_storage/sfx/2356/2356-preview.mp3",
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
    preload: preloadAllSounds,
  };
};
