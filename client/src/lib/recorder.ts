/**
 * Cross-browser audio recording & Web Speech Recognition helpers.
 * Automatically negotiates MIME types so recordings play back and upload cleanly
 * on both iOS Safari (audio/mp4) and Chrome/Edge/Android (audio/webm;codecs=opus).
 */

export interface RecordedAudio {
  blob: Blob;
  objectUrl: string;
  mimeType: string;
  durationSec: number;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function pickSupportedAudioMime(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/mp4';
  }
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

export function normalizeBaseMime(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!base) return 'audio/mp4';
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return base;
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取錄音資料'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private chosenMime = '';

  async start(): Promise<void> {
    if (!isAudioRecordingSupported()) {
      throw new Error('此瀏覽器不支援麥克風錄音，請改用 Chrome、Safari 或輸入文字練習。');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.stream = stream;
    this.chunks = [];
    this.chosenMime = pickSupportedAudioMime();

    const options: MediaRecorderOptions = this.chosenMime
      ? { mimeType: this.chosenMime, audioBitsPerSecond: 48000 }
      : { audioBitsPerSecond: 48000 };

    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream, options);
    } catch {
      mr = new MediaRecorder(stream);
    }

    this.mediaRecorder = mr;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    this.startedAt = Date.now();
    mr.start(250);
  }

  stop(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      const mr = this.mediaRecorder;
      if (!mr || mr.state === 'inactive') {
        this.cleanup();
        reject(new Error('錄音尚未啟動'));
        return;
      }

      mr.onstop = () => {
        const rawMime = mr.mimeType || this.chosenMime || 'audio/mp4';
        const mimeType = normalizeBaseMime(rawMime);
        const blob = new Blob(this.chunks, { type: mimeType });
        const durationSec = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
        this.cleanup();
        if (blob.size < 400) {
          reject(new Error('錄音時間過短，請至少開口說 1 秒以上再停止。'));
          return;
        }
        resolve({
          blob,
          objectUrl: URL.createObjectURL(blob),
          mimeType,
          durationSec,
        });
      };

      mr.onerror = () => {
        this.cleanup();
        reject(new Error('錄音過程發生錯誤，請再試一次。'));
      };

      mr.stop();
    });
  }

  cancel() {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      }
    } catch {
      // ignore
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

// Optional Web Speech Recognition (live STT dictation in Chrome/Edge/Android)
interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isLiveSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

export function createSpeechRecognition(opts: {
  lang?: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}): BrowserSpeechRecognition | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang || 'en-US';
  rec.continuous = false;
  rec.interimResults = true;

  rec.onresult = (event) => {
    let combined = '';
    let finalFlag = false;
    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      combined += res[0]?.transcript || '';
      if (res.isFinal) finalFlag = true;
    }
    opts.onTranscript(combined.trim(), finalFlag);
  };

  rec.onerror = (ev) => {
    if (ev.error === 'no-speech') {
      opts.onError?.('沒有偵測到聲音，請靠近麥克風再試一次。');
    } else if (ev.error === 'not-allowed') {
      opts.onError?.('請允許瀏覽器使用麥克風權限。');
    } else if (ev.error !== 'aborted') {
      opts.onError?.(`語音辨識中斷（${ev.error}），建議改用「按住錄音直傳 AI」。`);
    }
  };

  rec.onend = () => {
    opts.onEnd?.();
  };

  return rec;
}
