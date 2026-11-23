import type { Env } from './types';

interface GroqChatOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}

export interface GroqTranscriptionResult {
  text: string;
  avgLogprob: number | null;
  noSpeechProb: number | null;
  durationSec: number | null;
}

const CHAT_MODEL_PRIORITY = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'gemma2-9b-it',
];

const STT_MODEL_PRIORITY = ['whisper-large-v3-turbo', 'whisper-large-v3'];

const EXCLUDED_CHAT_RE = /whisper|guard|tts|playai|orpheus|safeguard|embed|vision-preview|distil-whisper/i;

// Module-level cache per Worker isolate so we don't re-query /models on every turn
let cachedWorkingChatModel: string | null = null;
let cachedWorkingSttModel: string | null = null;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function mimeToExt(mimeType: string): string {
  switch (mimeType) {
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    case 'audio/aac':
      return 'aac';
    default:
      return 'webm';
  }
}

function extractJsonObject(raw: string): string {
  let clean = raw.trim();
  // Strip <think>...</think> blocks if a reasoning model emits them
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(clean);
  if (fenced) clean = fenced[1].trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return clean.slice(firstBrace, lastBrace + 1);
  }
  return clean;
}

export async function listAvailableGroqModels(env: Env): Promise<string[]> {
  if (!env.GROQ_API_KEY) return [];
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as {
    data?: { id?: string; active?: boolean }[];
  } | null;
  if (!Array.isArray(data?.data)) return [];
  return data.data
    .filter((m) => m.id && m.active !== false)
    .map((m) => m.id as string);
}

function pickBestModel(available: string[], preferred: string, priorityList: string[], isStt: boolean): string[] {
  const ordered: string[] = [];
  const addUnique = (id: string) => {
    if (id && !ordered.includes(id)) ordered.push(id);
  };

  if (available.length > 0) {
    if (available.includes(preferred)) addUnique(preferred);
    for (const p of priorityList) {
      if (available.includes(p)) addUnique(p);
    }
    for (const id of available) {
      if (isStt) {
        if (/whisper/i.test(id)) addUnique(id);
      } else if (!EXCLUDED_CHAT_RE.test(id)) {
        addUnique(id);
      }
    }
    return ordered;
  }

  // Fallback if /models call failed
  addUnique(preferred);
  for (const p of priorityList) addUnique(p);
  return ordered;
}

export async function transcribeAudioWithGroq(
  env: Env,
  audioBase64: string,
  audioMimeType: string
): Promise<GroqTranscriptionResult> {
  if (!env.GROQ_API_KEY) {
    throw new Error('Server misconfigured: GROQ_API_KEY secret is not set on Cloudflare Worker');
  }

  const configuredStt = env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
  const primaryModel = cachedWorkingSttModel || configuredStt;
  const bytes = base64ToUint8Array(audioBase64);
  const ext = mimeToExt(audioMimeType);

  const attemptTranscribe = async (model: string) => {
    const blob = new Blob([bytes], { type: audioMimeType });
    const form = new FormData();
    form.append('file', blob, `recording.${ext}`);
    form.append('model', model);
    form.append('language', 'en');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    return fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
  };

  let res = await attemptTranscribe(primaryModel);
  let usedModel = primaryModel;

  if (res.status === 404 || res.status === 400) {
    const errText = await res.text().catch(() => '');
    if (/model_not_found|does not exist|decommissioned/i.test(errText)) {
      const available = await listAvailableGroqModels(env);
      const candidates = pickBestModel(available, configuredStt, STT_MODEL_PRIORITY, true).filter(
        (m) => m !== primaryModel
      );
      let succeeded = false;
      for (const cand of candidates.slice(0, 3)) {
        const retry = await attemptTranscribe(cand);
        if (retry.ok) {
          res = retry;
          usedModel = cand;
          succeeded = true;
          break;
        }
      }
      if (!succeeded) {
        throw new Error(
          `Groq Whisper STT error (HTTP ${res.status}): ${errText.slice(0, 220)} | Available STT: ${
            candidates.join(', ') || 'none'
          }`
        );
      }
    } else {
      throw new Error(`Groq Whisper STT error (HTTP ${res.status}): ${errText.slice(0, 260)}`);
    }
  } else if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Groq Whisper STT error (HTTP ${res.status}): ${errBody.slice(0, 260)}`);
  }

  cachedWorkingSttModel = usedModel;

  const data = (await res.json()) as {
    text?: string;
    duration?: number;
    segments?: { avg_logprob?: number; no_speech_prob?: number }[];
  };

  const segments = Array.isArray(data.segments) ? data.segments : [];
  const avgLogprob =
    segments.length > 0
      ? Number(
          (
            segments.reduce(
              (sum, s) => sum + (typeof s.avg_logprob === 'number' ? s.avg_logprob : -0.3),
              0
            ) / segments.length
          ).toFixed(3)
        )
      : null;
  const noSpeechProb =
    segments.length > 0
      ? Number(
          (
            segments.reduce(
              (sum, s) => sum + (typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0),
              0
            ) / segments.length
          ).toFixed(3)
        )
      : null;

  return {
    text: (data.text || '').trim(),
    avgLogprob,
    noSpeechProb,
    durationSec: typeof data.duration === 'number' ? Number(data.duration.toFixed(2)) : null,
  };
}

export async function callGroqJson<T>(env: Env, opts: GroqChatOptions): Promise<T> {
  if (!env.GROQ_API_KEY) {
    throw new Error('Server misconfigured: GROQ_API_KEY secret is not set on Cloudflare Worker');
  }

  const configuredModel = env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';
  const primaryModel = cachedWorkingChatModel || configuredModel;

  const attemptChat = async (model: string, useJsonMode: boolean) => {
    const body: Record<string, unknown> = {
      model,
      temperature: opts.temperature ?? 0.6,
      messages: [
        { role: 'system', content: opts.systemInstruction },
        { role: 'user', content: opts.userPrompt },
      ],
    };
    if (useJsonMode) {
      body.response_format = { type: 'json_object' };
    }
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  };

  let res = await attemptChat(primaryModel, true);
  let usedModel = primaryModel;

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const isModelError =
      res.status === 404 ||
      /model_not_found|does not exist|decommissioned|not supported/i.test(errText);

    if (isModelError) {
      const available = await listAvailableGroqModels(env);
      const candidates = pickBestModel(available, configuredModel, CHAT_MODEL_PRIORITY, false).filter(
        (m) => m !== primaryModel
      );
      let succeeded = false;
      let lastErr = errText;

      for (const cand of candidates.slice(0, 5)) {
        let retry = await attemptChat(cand, true);
        if (!retry.ok && retry.status === 400) {
          // Some models reject response_format: json_object — retry without it
          retry = await attemptChat(cand, false);
        }
        if (retry.ok) {
          res = retry;
          usedModel = cand;
          succeeded = true;
          break;
        }
        lastErr = await retry.text().catch(() => lastErr);
      }

      if (!succeeded) {
        throw new Error(
          `Groq Chat API error (HTTP ${res.status}): ${lastErr.slice(0, 220)} | Available models on your Groq key: ${
            available.slice(0, 12).join(', ') || 'none'
          }`
        );
      }
    } else if (res.status === 400 && /response_format|json_validate_failed/i.test(errText)) {
      const retry = await attemptChat(primaryModel, false);
      if (!retry.ok) {
        const retryErr = await retry.text().catch(() => '');
        throw new Error(`Groq Chat API error (HTTP ${retry.status}): ${retryErr.slice(0, 260)}`);
      }
      res = retry;
    } else {
      throw new Error(`Groq Chat API error (HTTP ${res.status}): ${errText.slice(0, 260)}`);
    }
  }

  cachedWorkingChatModel = usedModel;

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Groq returned an empty response');
  }

  const clean = extractJsonObject(rawText);
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Groq (${usedModel}) returned non-JSON content: ${clean.slice(0, 180)}`);
  }
}
