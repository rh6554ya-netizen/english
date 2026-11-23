import type {
  Category,
  ContentSource,
  CulturalNote,
  Dialogue,
  DialogueTurn,
  Exercise,
  Expression,
  ExpressionGroup,
  ListeningPlaylist,
  Scenario,
  SentencePattern,
  UserProfile,
  UserScenarioProgress,
  UserSrsCard,
  Vocabulary,
} from '../../../shared/types';
import { firestoreApi } from './firestoreApi';

const USE_FIRESTORE_DIRECT = import.meta.env.VITE_USE_FIRESTORE_DIRECT === 'true';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface DashboardResponse {
  user: UserProfile;
  stats: {
    streak_days: number;
    today_minutes: number;
    listening_minutes: number;
    due_srs_count: number;
    total_srs_count: number;
    completed_scenarios: number;
    total_scenarios: number;
  };
  continue_scenario: (Scenario & { progress: UserScenarioProgress | null }) | null;
  recommended_scenarios: (Scenario & {
    category: Category | null;
    progress: UserScenarioProgress | null;
  })[];
  backend: { mode: 'firebase' | 'local'; projectId: string | null; note: string };
}

export interface ScenarioListItem extends Scenario {
  category: Category | null;
  parent_category: Category | null;
  dialogue_types: string[];
  turns_count: number;
  patterns_count: number;
  progress: UserScenarioProgress | null;
}

export interface HydratedTurn extends DialogueTurn {
  highlights: { highlight_text: string; vocabulary: Vocabulary }[];
}

export interface ScenarioDetailResponse {
  scenario: Scenario;
  category: Category | null;
  parent_category: Category | null;
  dialogues: (Dialogue & { source: ContentSource | null; turns: HydratedTurn[] })[];
  cultural_notes: CulturalNote[];
  sentence_patterns: SentencePattern[];
  exercises: Exercise[];
  progress: UserScenarioProgress | null;
}

export interface HydratedPlaylistTrack {
  playlist_item_id: string;
  item_type: string;
  item_id: string;
  label: string;
  prompt_en: string | null;
  text_en: string;
  text_zh: string;
  audio_normal_url: string | null;
  audio_slow_url: string | null;
  audio_zh_url: string | null;
}

export interface HydratedPlaylist extends ListeningPlaylist {
  tracks: HydratedPlaylistTrack[];
}

export interface SurvivalPhrase {
  id: string;
  tag: string;
  category: 'travel' | 'emergency' | 'shopping';
  en: string;
  zh: string;
  tip_zh: string;
  audio_normal_url: string;
  audio_slow_url: string;
}

const httpApi = {
  getHealth: () =>
    request<{
      ok: boolean;
      backend: { mode: 'firebase' | 'local'; projectId: string | null; note: string };
      counts: Record<string, number>;
    }>('/api/health'),

  getDashboard: () => request<DashboardResponse>('/api/dashboard'),

  updateProfile: (body: Partial<UserProfile>) =>
    request<{ user: UserProfile }>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getCategories: () =>
    request<{
      categories: (Category & { children: Category[]; scenario_count: number })[];
      flat: Category[];
    }>('/api/categories'),

  getScenarios: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ scenarios: ScenarioListItem[] }>(`/api/scenarios${qs}`);
  },

  getScenarioDetail: (slug: string) =>
    request<ScenarioDetailResponse>(`/api/scenarios/${encodeURIComponent(slug)}`),

  updateScenarioProgress: (
    scenarioId: string,
    body: {
      step1_blind_listen_done?: boolean;
      step2_study_done?: boolean;
      step3_shadowing_done?: boolean;
      step4_quiz_best_score?: number;
      duration_seconds?: number;
    }
  ) =>
    request<{ progress: UserScenarioProgress }>(
      `/api/scenarios/${encodeURIComponent(scenarioId)}/progress`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  getPlaylists: () => request<{ playlists: HydratedPlaylist[] }>('/api/playlists'),

  createPlaylist: (body: {
    title_zh: string;
    description?: string;
    item_ids: { item_type: string; item_id: string }[];
  }) =>
    request<{ playlist: ListeningPlaylist }>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getQuick3sDrills: () => request<{ drills: Exercise[] }>('/api/drill/quick-3s'),

  submitQuick3sResult: (body: {
    exercise_id: string;
    rating: 'instant' | 'hesitated' | 'missed';
    duration_seconds?: number;
  }) =>
    request<{ ok: boolean; srs_added: boolean }>('/api/drill/quick-3s/result', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getPatterns: () =>
    request<{
      patterns: (SentencePattern & { scenario_title_zh: string; category: Category | null })[];
    }>('/api/patterns'),

  getExpressions: () =>
    request<{ groups: (ExpressionGroup & { expressions: Expression[] })[] }>('/api/expressions'),

  getSurvival: () =>
    request<{ phrases: SurvivalPhrase[]; patterns: SentencePattern[] }>('/api/survival'),

  getSrsCards: () => request<{ cards: UserSrsCard[]; due_count: number }>('/api/srs'),

  addSrsCard: (body: {
    item_type: UserSrsCard['item_type'];
    item_id: string;
    front_zh: string;
    back_en: string;
    ipa?: string | null;
    audio_url?: string | null;
    personal_note?: string | null;
  }) =>
    request<{ card: UserSrsCard; already_exists: boolean }>('/api/srs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reviewSrsCard: (id: string, quality: number) =>
    request<{ card: UserSrsCard }>(`/api/srs/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    }),

  updateSrsNote: (id: string, personal_note: string) =>
    request<{ card: UserSrsCard }>(`/api/srs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ personal_note }),
    }),

  deleteSrsCard: (id: string) =>
    request<{ ok: boolean }>(`/api/srs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  logPractice: (body: {
    activity_type: string;
    target_type?: string | null;
    target_id?: string | null;
    duration_seconds: number;
    score?: number | null;
    detail_json?: Record<string, unknown>;
  }) =>
    request('/api/practice-logs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAdminOverview: () =>
    request<{
      backend: { mode: 'firebase' | 'local'; projectId: string | null; note: string };
      sources: ContentSource[];
      collections: { name: string; count: number }[];
    }>('/api/admin/overview'),

  importAdminJson: (payload: unknown) =>
    request<{ ok: boolean; imported: Record<string, number> }>('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Phase 2 methods delegate to firestoreApi (works seamlessly in local/Firestore modes)
  getAiSessions: () => firestoreApi.getAiSessions(),
  saveAiSession: (body: Parameters<typeof firestoreApi.saveAiSession>[0]) =>
    firestoreApi.saveAiSession(body),
  deleteAiSession: (id: string) => firestoreApi.deleteAiSession(id),
  getGamificationSnapshot: () => firestoreApi.getGamificationSnapshot(),
  startTravelSprint: () => firestoreApi.startTravelSprint(),
};

export const api = USE_FIRESTORE_DIRECT ? firestoreApi : httpApi;
