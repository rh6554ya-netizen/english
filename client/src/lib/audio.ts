/**
 * Unified Audio Controller:
 * 1. Tries playing pre-generated Edge TTS MP3 (`audioUrl`) first.
 * 2. Automatically falls back to Web Speech API (`fallbackText`) if MP3 is unavailable.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentCancel: (() => void) | null = null;

export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentCancel) {
    const fn = currentCancel;
    currentCancel = null;
    fn();
  }
}

export interface PlayOptions {
  url?: string | null;
  fallbackText?: string;
  lang?: 'en-US' | 'en-GB' | 'zh-TW';
  rate?: number;
}

export function playAudio({
  url,
  fallbackText = '',
  lang = 'en-US',
  rate = 1.0,
}: PlayOptions): Promise<void> {
  stopAllAudio();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      currentCancel = null;
      resolve();
    };
    currentCancel = done;

    const speakFallback = () => {
      if (!fallbackText || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        done();
        return;
      }
      const utter = new SpeechSynthesisUtterance(fallbackText);
      utter.lang = lang;
      utter.rate = rate;
      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
    };

    if (url) {
      const audio = new Audio(url);
      audio.playbackRate = rate;
      currentAudio = audio;
      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        done();
      };
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        speakFallback();
      };
      audio.play().catch(() => {
        if (currentAudio === audio) currentAudio = null;
        speakFallback();
      });
    } else {
      speakFallback();
    }
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
