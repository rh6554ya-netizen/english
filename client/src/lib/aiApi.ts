import { auth } from './firebase';
import type {
  AiQuotaStatus,
  AiRescueHint,
  AiSessionReport,
  AiTurnFeedback,
  DifficultyLevel,
  PronunciationAssessment,
} from '../../../shared/types';

const CUSTOM_WORKER_KEY = 'echospeak_ai_worker_url_override';

export function getAiApiBase(): string {
  const envUrl = (import.meta.env.VITE_AI_API_BASE || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const override = (localStorage.getItem(CUSTOM_WORKER_KEY) || '').trim();
    if (override) return override.replace(/\/+$/, '');
  }
  return '';
}

export function setCustomAiApiBase(url: string) {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) localStorage.removeItem(CUSTOM_WORKER_KEY);
  else localStorage.setItem(CUSTOM_WORKER_KEY, clean);
}

export function isAiApiConfigured(): boolean {
  return Boolean(getAiApiBase());
}

export interface RoleplayContextPayload {
  scenario_id?: string | null;
  scenario_title_zh: string;
  scenario_title_en: string;
  setting_background: string;
  ai_role: string;
  ai_persona: string;
  user_role: string;
  difficulty_level: DifficultyLevel;
  missions: string[];
}

export interface RoleplayStartResult {
  ai_reply_en: string;
  ai_reply_zh: string;
  rescue_hints: AiRescueHint[];
  quota: AiQuotaStatus;
}

export interface RoleplayTurnResult {
  transcript: string;
  ai_reply_en: string;
  ai_reply_zh: string;
  turn_feedback: AiTurnFeedback;
  completed_mission_indices: number[];
  rescue_hints: AiRescueHint[];
  should_wrap_up: boolean;
  quota: AiQuotaStatus;
}

export interface RoleplayEvaluateResult extends AiSessionReport {
  quota: AiQuotaStatus;
}

export interface PronunciationAssessResult extends PronunciationAssessment {
  quota: AiQuotaStatus;
}

async function aiRequest<T>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const base = getAiApiBase();
  if (!base) {
    throw new Error(
      '尚未設定 Cloudflare Worker AI Proxy 網址（VITE_AI_API_BASE）。請完成 Worker 部署或於下方測試設定填入 Worker 網址。'
    );
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('目前為離線狀態，AI 口說與發音評測功能需要網路連線才能運作。');
  }
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('請先登入 Google 帳號，即可享有每日免費 AI 口說練習額度！');
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new Error(data?.error || `AI 服務請求失敗（HTTP ${res.status}）`);
  }
  return data as T;
}

export const aiApi = {
  getQuota: () => aiRequest<{ quota: AiQuotaStatus; is_admin: boolean }>('/api/ai/quota', undefined, 'GET'),

  startRoleplay: (context: RoleplayContextPayload) =>
    aiRequest<RoleplayStartResult>('/api/ai/roleplay/start', { context }),

  sendRoleplayTurn: (payload: {
    context: RoleplayContextPayload;
    history: { role: 'ai' | 'user'; text_en: string }[];
    userText?: string | null;
    audioBase64?: string | null;
    audioMimeType?: string | null;
  }) => aiRequest<RoleplayTurnResult>('/api/ai/roleplay/turn', payload),

  evaluateRoleplay: (payload: {
    context: RoleplayContextPayload;
    messages: { role: 'ai' | 'user'; text_en: string; used_audio?: boolean }[];
  }) => aiRequest<RoleplayEvaluateResult>('/api/ai/roleplay/evaluate', payload),

  assessPronunciation: (payload: {
    targetTextEn: string;
    audioBase64: string;
    audioMimeType: string;
    scenarioTitle?: string;
  }) => aiRequest<PronunciationAssessResult>('/api/ai/pronunciation/assess', payload),
};
