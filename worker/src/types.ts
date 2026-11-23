export interface Env {
  GROQ_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  GROQ_CHAT_MODEL?: string;
  GROQ_STT_MODEL?: string;
  DAILY_LIMIT_LEARNER?: string;
  DAILY_LIMIT_ADMIN?: string;
  ALLOWED_ORIGINS?: string;
  QUOTA_KV?: KVNamespace;
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  reset_at: string;
  storage: 'kv' | 'memory';
}

export interface RoleplayContextPayload {
  scenario_id?: string | null;
  scenario_title_zh: string;
  scenario_title_en: string;
  setting_background: string;
  ai_role: string;
  ai_persona: string;
  user_role: string;
  difficulty_level: 'zero_basis' | 'beginner' | 'intermediate';
  missions: string[];
}

export interface RoleplayHistoryItem {
  role: 'ai' | 'user';
  text_en: string;
}

export interface RescueHint {
  en: string;
  zh: string;
  tone: 'simple' | 'natural' | 'polite';
}

export interface TurnFeedback {
  naturalness_score: number;
  grammar_correction: string | null;
  native_upgrade_en: string;
  native_upgrade_reason_zh: string;
  pronunciation_tip_zh: string | null;
}

export interface RoleplayStartResponse {
  ai_reply_en: string;
  ai_reply_zh: string;
  rescue_hints: RescueHint[];
  quota: QuotaStatus;
}

export interface RoleplayTurnResponse {
  transcript: string;
  ai_reply_en: string;
  ai_reply_zh: string;
  turn_feedback: TurnFeedback;
  completed_mission_indices: number[];
  rescue_hints: RescueHint[];
  should_wrap_up: boolean;
  quota: QuotaStatus;
}

export interface RoleplayEvaluateResponse {
  overall_score: number;
  naturalness_score: number;
  grammar_score: number;
  task_completion_score: number;
  pronunciation_score: number | null;
  summary_zh: string;
  strengths_zh: string[];
  focus_areas_zh: string[];
  upgrade_cards: {
    user_said: string;
    native_en: string;
    meaning_zh: string;
    nuance_note_zh: string;
  }[];
  quota: QuotaStatus;
}

export interface PronunciationAssessResponse {
  overall_score: number;
  accuracy_score: number;
  fluency_score: number;
  intonation_score: number;
  heard_text: string;
  word_feedback: {
    word: string;
    status: 'good' | 'watch' | 'missed';
    ipa?: string | null;
    tip_zh?: string | null;
  }[];
  linking_tips_zh: string[];
  encouragement_zh: string;
  quota: QuotaStatus;
}
