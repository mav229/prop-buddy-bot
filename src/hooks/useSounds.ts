// Sleek, modern UI sound effects
// Using data URIs for instant, reliable playback (no CORS issues)

// Base64 encoded tiny sounds - ~1-2kb each for instant loading
const SOUNDS = {
  // Soft pop for opening (synthetic)
  open: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onbezv8PDv7Wzn45+dF1dZ3yJnau4vcHDv7u0qZyNfHBjW2N3iJmrucHExMG6r6KUg3RnXmFueoydrrnBw8G8tKaZiXtvYV5nd4iXpLK8wMC9t66jlIV4a2Njb3yKl6S0vb/AvbevpJeHe29lY2x5hpOgr7u+v7+7tKqfkYN3bGVlbXqGkp6stvz9/fy1q6GUhn10a2Zqd4KOmKazur2+vbesope=",
  // Light notification ping
  notification: "data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTQFAACAgoKBgIB/gIGCg4SEhIOCgYB/fn5/gIGCg4SEhIOCgH99fH1+gIGDhIWFhYSDgX9+fHt8foCChIWGhoaFg4F/fXt6e36AgoSGh4eHhoSCf3x6eXp9gIKEhoeIh4eFgn98enl5fH+ChIaHiIiHhYJ/fHp4eXt+gYOFh4iJiIeEgX56eHh6fYCChYeIiYmIhYJ+e3h3eHt+gYSGiImJiYaDf3t4dnd6fYCDhoiJiomHg398eXZ2eXyAg4aIiouKiIWBfHl2dXh7gIOGiYqLioiEgHx4dXR3en6ChYiKi4uJhYF8d3RzdniAgoaJi4yLiYWAfHZ0c3Z5fYGFiIqMjIqGgn14dHJ0d3uAg4eJi4yMiYWAfHdzc3V5fYGFiIuMjYuHg355dHJzdXl9gYWIiouMi4eDfnl0cnN2en6ChYiKjIyKhoJ9eHRyc3Z6foKFiIuMjIqGgn14dHJ0d3t/g4eJi4yMiYWBfHdzc3V4fICEh4qLjIuIhIF8d3Nzd3l9gYSHiouMi4eDf3p2c3N2en2BhIeKi4yKh4N+eXVyc3Z6foKFiIqLjIqGgn15dXN0d3t/goaIiouMioaDfnl1c3R3e3+ChoeKi4yKhoJ9eHVzdHd7f4KGiIqLjImFgX15dXN1eHuAg4aIioqLiYWBfXl1c3V4e3+DhoiKi4qIhIF8eHVzdXh7f4OGiIqLiomFgXx4dXN1eHyAg4aIiouKiIWBfHh1c3V4fICEh4mKi4qIhIF8eHVzdXh7gIOGiIqKiomFgXx4dXN1eHyAg4aIioqKiIWBfHh1c3V4e4CDhoiKiomIhYF8eHZzdnh7f4OGiIqKiYeFgXx4dnR1eHuAg4aIiomJhoWBfXl2dHZ4e3+DhoiJiYmGhIF9eXZ0dXh7f4OGiImJiIaFgX15dnR1eHt/g4aIiYmIhoWBfXl2dHV4e3+DhoiJiYiGhYF9eXZ0dXh7f4OGiIiIiIaFgX55dnR2eHuAg4aIiIiIhoWBfXl2dHZ4e3+DhoiIiIiGhYF9eXZ0dXh7f4OGh4iIh4aFgX55dnV2eHuAgoWHiIiHhoWBfnl2dXZ4e3+ChYeHiIeGhIF+eXZ1dnh7f4KFh4eHh4aEgX55d3V2eHt/goWHh4eHhoSBfnl3dXZ4e3+ChYeHh4eGhIF+end1dnh7f4KFh4eHhoaEgX55d3V2eHt/goWHh4eGhYSBfnl3dXZ4e3+ChYaHh4aFhIF+eXd1dnh7f4KFhoeHhoWEgX55d3V2eHt/goWGh4eGhYSBfnl3dXZ4e3+ChYaHh4aFhIF+end1dnh7f4KFhoeHhoWEgX55d3V2eHt/goWGh4aGhYSBfnl3dXZ4e3+ChYaGhoaFhIF+end1dnh7f4KFhoeGhoWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoaFhIF+eXd1dnd7f4KFhoeGhoWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoaFhIF+end1dnd7f4KFhoeGhoWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoWFhIF+eXd1dnd7f4KFhoeGhoWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoWFhIF+end2dnh7f4KFhoeGhYWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoWFhIF+end2d3h7f4KFhoeGhYWEgX55d3V2eHt/goWGhoaFhYSBfnl3dXZ4e3+ChYaGhoWFhIF+end2d3h7f4KFhoeGhYWEgX55d3V2eHt/goWGhoaFhYSBfnl3dnZ4e3+ChYaGhoWFhIF+end2d3h7f4KFhoeGhYWEgX55d3Z2eHt/goWGhoaFhYSBfnl3dnZ4e3+ChYaGhoWFhIF+end2d3h7f4KFhoaGhYWEgX55d3Z2eHt/",
  // Simple pop for sending
  send: "data:audio/wav;base64,UklGRpQDAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YXADAACAf4CBgoODhIOCgX9+fX5/gIGBgoKCgYB/fn19fn+AgYGCgoKBgH9+fX19f4CAgYKCgoGAf359fX1+f4CAgYGBgYB/fn19fX5/gICBgYGBgH9+fX19fn+AgIGBgYGAf359fX1+f4CAgYGBgYB/fn59fX5/gICBgYGBgH9+fn19fn+AgIGBgYGAf35+fX1+f4CAgYGBgYB/fn59fX5/gICBgYGBgH9+fn19fn+AgIGBgYGAf35+fX1+f4CAgYGBgYCAf35+fX5/gICBgYGBgIB/fn59fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICA",
  // Gentle receive chime
  receive: "data:audio/wav;base64,UklGRnQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAEAACAf4GChISFhoaGhoWEg4F/fXx8fX+AgoSFhoeHh4aFg4F+fHt7fH6AgoSGh4iIiIeFg4B9e3p6fH6Ag4WHiImJiIeEgX57eXl7foGEhoeJiomIhoN/fHl4eXt+gYSHiImKiYiFgn56d3d5fH+ChYiJioqJh4SAfXl3d3l8f4KFiImKioiGg395d3Z3en2Ag4aJiouKiYaDf3t4dnZ5fICDhoiKi4qJhoN/e3h2dnh7foGEh4mKi4qHhIB8eHV1eHt+goWIiouLioeEgHx4dXV3enyBhIeJi4uKiIWBfXl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiYqLioiFgn55dnV3en2Ag4aJiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKi4qIhYJ+eXZ1d3p9gIOGiIqLioiFgn55dnV3en2Ag4aIiouKiIWCfnl2dXd6fYCDhoiKioqIhYJ+eXZ1d3p9gIOGiIqKioiFgn55dnV3en2Ag4aIioqKiIWCfnl2dXd6fYCDhoiKioqIhYJ+eXZ1d3p9gIOGiIqKiYiFgn55",
  // Soft code/typing click
  code: "data:audio/wav;base64,UklGRjICAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YQ4CAACAf4GCgoODg4KBgH9+fX5/gIGBgoKCgYB/fn19fn+AgYGCgoKBgH9+fX19f4CAgYKCgoGAf359fX1+f4CAgYGBgYB/fn19fX5/gICBgYGBgH9+fX19fn+AgIGBgYGAf359fX1+f4CAgYGBgYB/fn59fX5/gICBgYGBgH9+fn19fn+AgIGBgYGAf35+fX1+f4CAgYGBgYB/fn59fX5/gICBgYGBgH9+fn19fn+AgIGBgYGAf35+fX1+f4CAgYGBgYCAf35+fX5/gICBgYGBgIB/fn59fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgYGBgYCAf35+fn5/gICBgYGBgIB/fn5+fn+AgIGBgYGAgH9+fn5+f4CAgA==",
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
