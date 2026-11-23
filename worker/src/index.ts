import { verifyFirebaseIdToken } from './auth';
import { callGroqJson, transcribeAudioWithGroq } from './groq';
import {
  buildEvaluatePrompt,
  buildPronunciationPrompt,
  buildStartPrompt,
  buildTurnPrompt,
} from './prompts';
import { consumeQuota, getQuotaStatus } from './rateLimit';
import type {
  Env,
  PronunciationAssessResponse,
  QuotaStatus,
  RoleplayContextPayload,
  RoleplayEvaluateResponse,
  RoleplayHistoryItem,
  RoleplayStartResponse,
  RoleplayTurnResponse,
} from './types';

const MAX_AUDIO_BASE64_LEN = 3_500_000; // ~2.6 MB raw audio
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
]);

function normalizeMimeType(raw?: string | null): string | null {
  if (!raw) return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return ALLOWED_AUDIO_MIMES.has(base) ? base : null;
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedList = (
    env.ALLOWED_ORIGINS ||
    'https://rh6554ya-netizen.github.io,http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedOrigin = allowedList.includes(origin) ? origin : allowedList[0] || '*';

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    Vary: 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  quota?: QuotaStatus
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders,
  };
  if (quota) {
    headers['X-RateLimit-Limit'] = String(quota.limit);
    headers['X-RateLimit-Remaining'] = String(quota.remaining);
    headers['X-RateLimit-Reset'] = quota.reset_at;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function clampScore(v: unknown, fallback = 75): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Public health check
    if (request.method === 'GET' && (path === '/api/ai/health' || path === '/health')) {
      return jsonResponse(
        {
          ok: true,
          service: 'echospeak-ai-worker',
          provider: 'groq',
          chat_model: env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
          stt_model: env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
          groq_configured: Boolean(env.GROQ_API_KEY),
          kv_configured: Boolean(env.QUOTA_KV),
        },
        200,
        cors
      );
    }

    // All other /api/ai/* routes require Firebase Auth ID Token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return jsonResponse(
        { error: '請先登入 Google 帳號以使用 AI 口說功能（缺少驗證權杖）。' },
        401,
        cors
      );
    }

    let user;
    try {
      user = await verifyFirebaseIdToken(
        token,
        env.FIREBASE_PROJECT_ID || 'echospeak-english-studio'
      );
    } catch (err) {
      return jsonResponse(
        { error: `登入驗證失敗，請重新登入後再試：${(err as Error).message}` },
        401,
        cors
      );
    }

    try {
      // GET /api/ai/quota (does not consume quota)
      if (request.method === 'GET' && path === '/api/ai/quota') {
        const quota = await getQuotaStatus(env, user);
        return jsonResponse({ quota, is_admin: user.isAdmin }, 200, cors, quota);
      }

      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, cors);
      }

      // Consume 1 daily quota unit for all AI generation endpoints
      const { allowed, quota } = await consumeQuota(env, user);
      if (!allowed) {
        return jsonResponse(
          {
            error: `今日 AI 口說額度已達上限（${quota.limit} 次/日），將於明日 UTC 00:00 自動重置！`,
            quota,
          },
          429,
          cors,
          quota
        );
      }

      const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object') {
        return jsonResponse({ error: 'Invalid JSON request body' }, 400, cors, quota);
      }

      // 1. Start AI Roleplay
      if (path === '/api/ai/roleplay/start') {
        const ctx = payload.context as RoleplayContextPayload | undefined;
        if (!ctx?.scenario_title_en || !ctx?.ai_role || !Array.isArray(ctx.missions)) {
          return jsonResponse({ error: 'Missing roleplay context fields' }, 400, cors, quota);
        }

        const { systemInstruction, userPrompt } = buildStartPrompt(ctx);
        const result = await callGroqJson<Omit<RoleplayStartResponse, 'quota'>>(env, {
          systemInstruction,
          userPrompt,
          temperature: 0.7,
        });

        return jsonResponse(
          {
            ai_reply_en: result.ai_reply_en || 'Hi there! How can I help you today?',
            ai_reply_zh: result.ai_reply_zh || '嗨！今天有什麼我可以幫忙的嗎？',
            rescue_hints: Array.isArray(result.rescue_hints) ? result.rescue_hints.slice(0, 3) : [],
            quota,
          },
          200,
          cors,
          quota
        );
      }

      // 2. Roleplay Conversation Turn (Text or Audio via Groq Whisper + Llama 3.3)
      if (path === '/api/ai/roleplay/turn') {
        const ctx = payload.context as RoleplayContextPayload | undefined;
        const history = Array.isArray(payload.history)
          ? (payload.history as RoleplayHistoryItem[]).slice(-20)
          : [];
        const rawUserText = typeof payload.userText === 'string' ? payload.userText.trim() : '';
        const audioBase64 =
          typeof payload.audioBase64 === 'string' ? payload.audioBase64.trim() : null;
        const audioMimeType = normalizeMimeType(
          typeof payload.audioMimeType === 'string' ? payload.audioMimeType : null
        );

        if (!ctx?.scenario_title_en || !ctx?.ai_role) {
          return jsonResponse({ error: 'Missing roleplay context' }, 400, cors, quota);
        }
        if (!rawUserText && !audioBase64) {
          return jsonResponse({ error: '請提供文字或語音錄音內容' }, 400, cors, quota);
        }

        let spokenText = rawUserText;
        let audioMeta: { avgLogprob: number | null; durationSec: number | null } | null = null;

        if (audioBase64) {
          if (audioBase64.length > MAX_AUDIO_BASE64_LEN) {
            return jsonResponse(
              { error: '錄音檔案過大，請將單次錄音控制在 45 秒內' },
              413,
              cors,
              quota
            );
          }
          if (!audioMimeType) {
            return jsonResponse({ error: '不支援的音訊格式' }, 400, cors, quota);
          }

          const stt = await transcribeAudioWithGroq(env, audioBase64, audioMimeType);
          spokenText = stt.text || rawUserText;
          if (!spokenText) {
            return jsonResponse(
              { error: '沒有辨識到語音內容，請靠近麥克風再清楚說一次！' },
              400,
              cors,
              quota
            );
          }
          audioMeta = { avgLogprob: stt.avgLogprob, durationSec: stt.durationSec };
        }

        const { systemInstruction, userPrompt } = buildTurnPrompt(
          ctx,
          history,
          spokenText,
          audioMeta
        );
        const result = await callGroqJson<Omit<RoleplayTurnResponse, 'quota'>>(env, {
          systemInstruction,
          userPrompt,
          temperature: 0.6,
        });

        const safeFeedback = {
          naturalness_score: clampScore(result.turn_feedback?.naturalness_score, 78),
          grammar_correction: result.turn_feedback?.grammar_correction || null,
          native_upgrade_en: result.turn_feedback?.native_upgrade_en || spokenText,
          native_upgrade_reason_zh:
            result.turn_feedback?.native_upgrade_reason_zh || '這樣表達更貼近美國日常口語習慣。',
          pronunciation_tip_zh: audioMeta
            ? result.turn_feedback?.pronunciation_tip_zh || null
            : null,
        };

        return jsonResponse(
          {
            transcript: spokenText,
            ai_reply_en: result.ai_reply_en || 'Got it! Anything else I can help with?',
            ai_reply_zh: result.ai_reply_zh || '了解！還有其他需要幫忙的嗎？',
            turn_feedback: safeFeedback,
            completed_mission_indices: Array.isArray(result.completed_mission_indices)
              ? result.completed_mission_indices.filter((n) => typeof n === 'number')
              : [],
            rescue_hints: Array.isArray(result.rescue_hints) ? result.rescue_hints.slice(0, 3) : [],
            should_wrap_up: Boolean(result.should_wrap_up),
            quota,
          },
          200,
          cors,
          quota
        );
      }

      // 3. Roleplay Session Evaluation Report
      if (path === '/api/ai/roleplay/evaluate') {
        const ctx = payload.context as RoleplayContextPayload | undefined;
        const messages = Array.isArray(payload.messages)
          ? (payload.messages as { role: 'ai' | 'user'; text_en: string; used_audio?: boolean }[])
          : [];
        if (!ctx?.scenario_title_en || messages.length === 0) {
          return jsonResponse({ error: '缺少對話紀錄，無法產生總評' }, 400, cors, quota);
        }

        const { systemInstruction, userPrompt } = buildEvaluatePrompt(ctx, messages);
        const result = await callGroqJson<Omit<RoleplayEvaluateResponse, 'quota'>>(env, {
          systemInstruction,
          userPrompt,
          temperature: 0.5,
        });

        return jsonResponse(
          {
            overall_score: clampScore(result.overall_score, 80),
            naturalness_score: clampScore(result.naturalness_score, 80),
            grammar_score: clampScore(result.grammar_score, 80),
            task_completion_score: clampScore(result.task_completion_score, 80),
            pronunciation_score:
              typeof result.pronunciation_score === 'number'
                ? clampScore(result.pronunciation_score, 80)
                : null,
            summary_zh: result.summary_zh || '表現很棒！你已順利完成這次情境口說演練。',
            strengths_zh: Array.isArray(result.strengths_zh) ? result.strengths_zh : [],
            focus_areas_zh: Array.isArray(result.focus_areas_zh) ? result.focus_areas_zh : [],
            upgrade_cards: Array.isArray(result.upgrade_cards) ? result.upgrade_cards.slice(0, 5) : [],
            quota,
          },
          200,
          cors,
          quota
        );
      }

      // 4. Step 3 Pronunciation & Intonation Assessment (Groq Whisper STT + Llama 3.3 Coaching)
      if (path === '/api/ai/pronunciation/assess') {
        const targetTextEn =
          typeof payload.targetTextEn === 'string' ? payload.targetTextEn.trim() : '';
        const scenarioTitle =
          typeof payload.scenarioTitle === 'string' ? payload.scenarioTitle.trim() : undefined;
        const audioBase64 =
          typeof payload.audioBase64 === 'string' ? payload.audioBase64.trim() : '';
        const audioMimeType = normalizeMimeType(
          typeof payload.audioMimeType === 'string' ? payload.audioMimeType : null
        );

        if (!targetTextEn || !audioBase64 || !audioMimeType) {
          return jsonResponse({ error: '請提供目標英文句子與有效錄音檔' }, 400, cors, quota);
        }
        if (audioBase64.length > MAX_AUDIO_BASE64_LEN) {
          return jsonResponse({ error: '錄音檔案過大，請將單句跟讀控制在 30 秒內' }, 413, cors, quota);
        }

        const stt = await transcribeAudioWithGroq(env, audioBase64, audioMimeType);
        const { systemInstruction, userPrompt } = buildPronunciationPrompt(
          targetTextEn,
          stt.text,
          {
            avgLogprob: stt.avgLogprob,
            noSpeechProb: stt.noSpeechProb,
            durationSec: stt.durationSec,
          },
          scenarioTitle
        );

        const result = await callGroqJson<Omit<PronunciationAssessResponse, 'quota'>>(env, {
          systemInstruction,
          userPrompt,
          temperature: 0.4,
        });

        return jsonResponse(
          {
            overall_score: clampScore(result.overall_score, 80),
            accuracy_score: clampScore(result.accuracy_score, 80),
            fluency_score: clampScore(result.fluency_score, 80),
            intonation_score: clampScore(result.intonation_score, 80),
            heard_text: stt.text || result.heard_text || '',
            word_feedback: Array.isArray(result.word_feedback) ? result.word_feedback : [],
            linking_tips_zh: Array.isArray(result.linking_tips_zh) ? result.linking_tips_zh : [],
            encouragement_zh: result.encouragement_zh || '發音很清晰，多練幾次連音會更道地！',
            quota,
          },
          200,
          cors,
          quota
        );
      }

      return jsonResponse({ error: `Unknown AI endpoint: ${path}` }, 404, cors, quota);
    } catch (err) {
      return jsonResponse(
        { error: `AI 服務處理失敗：${(err as Error).message}` },
        502,
        cors
      );
    }
  },
};
