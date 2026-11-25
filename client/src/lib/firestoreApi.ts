import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestore, isFirebaseClientConfigured } from './firebase';
import { evaluateGamification, type ComputedGamification, type GamificationInputs } from './gamification';
import seedData from '../../../data/seed-notebooklm.json';
import type {
  Category,
  ContentSource,
  DatabaseState,
  Exercise,
  Expression,
  ExpressionGroup,
  ListeningPlaylist,
  PlaylistItem,
  SentencePattern,
  UserAiSession,
  UserGamification,
  UserPracticeLog,
  UserProfile,
  UserScenarioProgress,
  UserSrsCard,
} from '../../../shared/types';
import type {
  DashboardResponse,
  HydratedPlaylist,
  HydratedPlaylistTrack,
  ScenarioDetailResponse,
  ScenarioListItem,
  SurvivalPhrase,
} from './api';

const GUEST_USER_ID = 'demo-user';
const GUEST_STORAGE_KEY = 'echospeak_guest_user_v2';
const AUTH_USER_CACHE_PREFIX = 'echospeak_user_cache_v1_';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Firestore request timed out (${ms}ms)`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface AuthUserInfo {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
}

const PUBLIC_CONTENT_COLLECTIONS = [
  'content_sources',
  'categories',
  'scenarios',
  'dialogues',
  'dialogue_turns',
  'sentence_patterns',
  'expression_groups',
  'expressions',
  'vocabulary',
  'dialogue_turn_vocabulary',
  'cultural_notes',
  'exercises',
] as const;

type PublicContentKey = (typeof PUBLIC_CONTENT_COLLECTIONS)[number];

interface UserScopedState {
  users: UserProfile[];
  user_scenario_progress: UserScenarioProgress[];
  user_srs_cards: UserSrsCard[];
  user_practice_logs: UserPracticeLog[];
  user_playlists: ListeningPlaylist[];
  user_playlist_items: PlaylistItem[];
  user_ai_sessions: UserAiSession[];
  user_gamification: UserGamification | null;
}

const SURVIVAL_PHRASES: SurvivalPhrase[] = [
  {
    id: 'surv-1',
    tag: '證照查驗',
    category: 'travel',
    en: 'I am here for tourism and will be staying for seven days.',
    zh: '我是來觀光的，預計停留七天。',
    tip_zh: '過海關最常被問的兩大問題：目的（tourism）與天數（seven days），一句答完最俐落。',
    audio_normal_url: '/audio/survival/surv-1_normal.mp3',
    audio_slow_url: '/audio/survival/surv-1_slow.mp3',
  },
  {
    id: 'surv-2',
    tag: '海關申報',
    category: 'travel',
    en: 'I have nothing to declare, only my personal belongings and carry-on baggage.',
    zh: '我沒有任何需要申報的物品，只有隨身個人行李。',
    tip_zh: '走綠色免申報通道（Nothing to Declare）被抽查時使用。',
    audio_normal_url: '/audio/survival/surv-2_normal.mp3',
    audio_slow_url: '/audio/survival/surv-2_slow.mp3',
  },
  {
    id: 'surv-3',
    tag: '飲食過敏',
    category: 'travel',
    en: 'I have a severe food allergy to nuts and seafood; can you confirm these dishes are safe for me?',
    zh: '我對堅果和海鮮有嚴重食物過敏，能否幫我確認這些菜餚安全無虞？',
    tip_zh: '點餐前直接秀給服務生看或點擊播放語音，避免誤食過敏原。',
    audio_normal_url: '/audio/survival/surv-3_normal.mp3',
    audio_slow_url: '/audio/survival/surv-3_slow.mp3',
  },
  {
    id: 'surv-4',
    tag: '護照遺失',
    category: 'emergency',
    en: 'My wallet and passport are missing. I need to report this and contact my embassy.',
    zh: '我的皮夾與護照遺失了。我需要報案並聯絡代表處／大使館。',
    tip_zh: '遺失護照第一步先取得警方報案證明（police report），再聯絡當地駐外辦事處補辦。',
    audio_normal_url: '/audio/survival/surv-4_normal.mp3',
    audio_slow_url: '/audio/survival/surv-4_slow.mp3',
  },
  {
    id: 'surv-5',
    tag: '突發急病',
    category: 'emergency',
    en: "I'm not feeling well and have severe pain. Can you take me to a doctor?",
    zh: '我身體非常不舒服且劇烈疼痛。可以帶我就醫看醫生嗎？',
    tip_zh: '可搭配手勢指出疼痛部位（chest / stomach / head）。',
    audio_normal_url: '/audio/survival/surv-5_normal.mp3',
    audio_slow_url: '/audio/survival/surv-5_slow.mp3',
  },
  {
    id: 'surv-6',
    tag: '救護叫車',
    category: 'emergency',
    en: "Please call an ambulance immediately! It's a medical emergency.",
    zh: '請立刻叫救護車！這是緊急醫療狀況。',
    tip_zh: '北美緊急電話 911、歐洲 112、英國 999、日本 119。',
    audio_normal_url: '/audio/survival/surv-6_normal.mp3',
    audio_slow_url: '/audio/survival/surv-6_slow.mp3',
  },
  {
    id: 'surv-7',
    tag: '報警求助',
    category: 'emergency',
    en: "I need urgent police assistance; I've been robbed.",
    zh: '我需要警察緊急協助；我被搶劫了。',
    tip_zh: '同時可請附近店員或路人協助撥打當地報警專線。',
    audio_normal_url: '/audio/survival/surv-7_normal.mp3',
    audio_slow_url: '/audio/survival/surv-7_slow.mp3',
  },
  {
    id: 'surv-8',
    tag: '迷路問路',
    category: 'travel',
    en: "Excuse me, I'm lost. Could you show me on the map how to get to the station?",
    zh: '不好意思，我迷路了。您能在地圖上指引我如何前往車站嗎？',
    tip_zh: '打開手機地圖直接請對方指方向，比純靠聽覺記憶左右轉更保險。',
    audio_normal_url: '/audio/survival/surv-8_normal.mp3',
    audio_slow_url: '/audio/survival/surv-8_slow.mp3',
  },
  {
    id: 'surv-9',
    tag: '購物試穿',
    category: 'shopping',
    en: 'Can I try this on? Where is the fitting room?',
    zh: '我可以試穿這個嗎？試衣間在哪裡？',
    tip_zh: '英國或部分百貨也會稱作 changing room。',
    audio_normal_url: '/audio/survival/surv-9_normal.mp3',
    audio_slow_url: '/audio/survival/surv-9_slow.mp3',
  },
  {
    id: 'surv-10',
    tag: '詢價折扣',
    category: 'shopping',
    en: 'How much is this, and is there any discount?',
    zh: '這個多少錢？有任何折扣優惠嗎？',
    tip_zh: '結帳前也可補問一句 Does the price include tax?（這是含稅價嗎？）',
    audio_normal_url: '/audio/survival/surv-10_normal.mp3',
    audio_slow_url: '/audio/survival/surv-10_slow.mp3',
  },
  {
    id: 'surv-11',
    tag: '刷卡退換',
    category: 'shopping',
    en: "Do you take credit cards, and can I return or exchange this if it doesn't fit?",
    zh: '你們收信用卡嗎？如果尺寸不合，我可以退貨或換貨嗎？',
    tip_zh: '記得保留原始收據（original receipt）與商品吊牌。',
    audio_normal_url: '/audio/survival/surv-11_normal.mp3',
    audio_slow_url: '/audio/survival/surv-11_slow.mp3',
  },
];

function calculateSm2(
  card: { ease_factor: number; interval_days: number; repetitions: number },
  quality: number
) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease_factor, interval_days, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  ease_factor = Number(
    Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)
  );

  const now = new Date();
  const next = new Date(now.getTime() + interval_days * 24 * 60 * 60 * 1000);
  return {
    ease_factor,
    interval_days,
    repetitions,
    last_reviewed_at: now.toISOString(),
    next_review_at: next.toISOString(),
  };
}

function randomId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${raw}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function cloneSeed(): DatabaseState {
  return JSON.parse(JSON.stringify(seedData)) as DatabaseState;
}

function getDocId(item: Record<string, unknown>): string | null {
  if (typeof item.id === 'string' && item.id) return item.id;
  if (typeof item.dialogue_turn_id === 'string' && typeof item.vocabulary_id === 'string') {
    return `${item.dialogue_turn_id}__${item.vocabulary_id}`;
  }
  return null;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function buildDefaultGuestState(seed: DatabaseState): UserScopedState {
  return {
    users: seed.users.length
      ? seed.users
      : [
          {
            id: GUEST_USER_ID,
            email: 'guest@echospeak.local',
            display_name: '訪客學員',
            role: 'learner',
            current_level: 'beginner',
            learning_goal: 'travel_solo',
            preferred_accent: 'US',
            daily_goal_minutes: 15,
            streak_days: 1,
            last_active_date: todayIsoDate(),
            created_at: new Date().toISOString(),
          },
        ],
    user_scenario_progress: seed.user_scenario_progress || [],
    user_srs_cards: seed.user_srs_cards || [],
    user_practice_logs: seed.user_practice_logs || [],
    user_playlists: [],
    user_playlist_items: [],
    user_ai_sessions: [],
    user_gamification: null,
  };
}

function buildNewAuthProfile(authUser: AuthUserInfo): UserProfile {
  return {
    id: authUser.uid,
    email: authUser.email || `${authUser.uid}@firebase.user`,
    display_name: authUser.displayName || 'EchoSpeak 學員',
    role: authUser.isAdmin ? 'admin' : 'learner',
    current_level: 'beginner',
    learning_goal: 'travel_solo',
    preferred_accent: 'US',
    daily_goal_minutes: 15,
    streak_days: 1,
    last_active_date: todayIsoDate(),
    created_at: new Date().toISOString(),
  };
}

class BrowserDataStore {
  private publicContent:
    | (Pick<DatabaseState, PublicContentKey> & {
        system_playlists: ListeningPlaylist[];
        system_playlist_items: PlaylistItem[];
      })
    | null = null;
  private publicLoading: Promise<void> | null = null;

  private authUser: AuthUserInfo | null = null;
  private loadedForUid: string | null = '__init__';
  private userState: UserScopedState | null = null;
  private userLoading: Promise<void> | null = null;

  private mode: 'firebase' | 'local' = 'local';
  private projectId: string | null = import.meta.env.VITE_FIREBASE_PROJECT_ID || null;

  setAuthUser(user: AuthUserInfo | null) {
    const nextUid = user?.uid ?? null;
    const prevUid = this.authUser?.uid ?? null;
    const prevAdmin = Boolean(this.authUser?.isAdmin);
    const nextAdmin = Boolean(user?.isAdmin);
    this.authUser = user;
    if (nextUid !== prevUid || prevAdmin !== nextAdmin) {
      this.userState = null;
      this.userLoading = null;
      this.loadedForUid = '__init__';
    }
  }

  getActiveUserId(): string {
    return this.authUser?.uid ?? GUEST_USER_ID;
  }

  isSignedIn(): boolean {
    return Boolean(this.authUser?.uid);
  }

  isAdminUser(): boolean {
    return Boolean(this.authUser?.isAdmin);
  }

  private async ensurePublicLoaded(): Promise<void> {
    if (this.publicContent) return;
    if (this.publicLoading) return this.publicLoading;

    this.publicLoading = (async () => {
      const seed = cloneSeed();
      if (isFirebaseClientConfigured && firestore) {
        try {
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const timeoutMs = isOffline ? 1800 : 8000;
          const [contentSnaps, sysPlSnap, sysPlItemSnap] = await withTimeout(
            Promise.all([
              Promise.all(
                PUBLIC_CONTENT_COLLECTIONS.map((col) => getDocs(collection(firestore!, col)))
              ),
              getDocs(
                query(collection(firestore, 'listening_playlists'), where('is_system', '==', true))
              ),
              getDocs(
                query(collection(firestore, 'playlist_items'), where('is_system', '==', true))
              ),
            ]),
            timeoutMs
          );

          const content = {} as Pick<DatabaseState, PublicContentKey> & {
            system_playlists: ListeningPlaylist[];
            system_playlist_items: PlaylistItem[];
          };

          PUBLIC_CONTENT_COLLECTIONS.forEach((col, idx) => {
            const snap = contentSnaps[idx];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (content as any)[col] = !snap.empty
              ? snap.docs.map((d) => d.data())
              : seed[col];
          });

          content.system_playlists = !sysPlSnap.empty
            ? (sysPlSnap.docs.map((d) => d.data()) as ListeningPlaylist[])
            : seed.listening_playlists.filter((p) => p.is_system);

          content.system_playlist_items = !sysPlItemSnap.empty
            ? (sysPlItemSnap.docs.map((d) => d.data()) as PlaylistItem[])
            : seed.playlist_items;

          this.mode = 'firebase';
          this.publicContent = content;
          return;
        } catch (err) {
          console.warn('[EchoSpeak] Public Firestore load failed, falling back to bundled seed:', err);
        }
      }

      this.mode = 'local';
      this.publicContent = {
        content_sources: seed.content_sources,
        categories: seed.categories,
        scenarios: seed.scenarios,
        dialogues: seed.dialogues,
        dialogue_turns: seed.dialogue_turns,
        sentence_patterns: seed.sentence_patterns,
        expression_groups: seed.expression_groups,
        expressions: seed.expressions,
        vocabulary: seed.vocabulary,
        dialogue_turn_vocabulary: seed.dialogue_turn_vocabulary,
        cultural_notes: seed.cultural_notes,
        exercises: seed.exercises,
        system_playlists: seed.listening_playlists.filter((p) => p.is_system),
        system_playlist_items: seed.playlist_items,
      };
    })().finally(() => {
      this.publicLoading = null;
    });

    return this.publicLoading;
  }

  private async ensureUserLoaded(): Promise<void> {
    const targetUid = this.authUser?.uid ?? null;
    if (this.userState && this.loadedForUid === targetUid) return;
    if (this.userLoading) return this.userLoading;

    this.userLoading = (async () => {
      if (targetUid && this.mode === 'firebase' && firestore && this.authUser) {
        try {
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const timeoutMs = isOffline ? 1800 : 8000;
          const [userDoc, progSnap, srsSnap, logSnap, plSnap, plItemSnap, aiSessSnap, gamifDoc] =
            await withTimeout(
              Promise.all([
                getDoc(doc(firestore, 'users', targetUid)),
                getDocs(
                  query(
                    collection(firestore, 'user_scenario_progress'),
                    where('user_id', '==', targetUid)
                  )
                ),
                getDocs(
                  query(collection(firestore, 'user_srs_cards'), where('user_id', '==', targetUid))
                ),
                getDocs(
                  query(
                    collection(firestore, 'user_practice_logs'),
                    where('user_id', '==', targetUid)
                  )
                ),
                getDocs(
                  query(
                    collection(firestore, 'listening_playlists'),
                    where('user_id', '==', targetUid)
                  )
                ),
                getDocs(
                  query(collection(firestore, 'playlist_items'), where('user_id', '==', targetUid))
                ),
                getDocs(
                  query(
                    collection(firestore, 'user_ai_sessions'),
                    where('user_id', '==', targetUid)
                  )
                ).catch(() => null),
                getDoc(doc(firestore, 'user_gamification', targetUid)).catch(() => null),
              ]),
              timeoutMs
            );

          let profile: UserProfile;
          if (userDoc.exists()) {
            profile = userDoc.data() as UserProfile;
          } else {
            profile = buildNewAuthProfile(this.authUser);
            if (!isOffline) {
              const batch = writeBatch(firestore);
              batch.set(doc(firestore, 'users', targetUid), stripUndefined(profile as unknown as Record<string, unknown>), { merge: true });
              await batch.commit();
            }
          }

          this.userState = {
            users: [profile],
            user_scenario_progress: progSnap.docs.map((d) => d.data() as UserScenarioProgress),
            user_srs_cards: srsSnap.docs.map((d) => d.data() as UserSrsCard),
            user_practice_logs: logSnap.docs.map((d) => d.data() as UserPracticeLog),
            user_playlists: plSnap.docs.map((d) => d.data() as ListeningPlaylist),
            user_playlist_items: plItemSnap.docs.map((d) => d.data() as PlaylistItem),
            user_ai_sessions: aiSessSnap
              ? aiSessSnap.docs.map((d) => d.data() as UserAiSession)
              : [],
            user_gamification:
              gamifDoc && gamifDoc.exists() ? (gamifDoc.data() as UserGamification) : null,
          };
          this.loadedForUid = targetUid;
          try {
            localStorage.setItem(
              `${AUTH_USER_CACHE_PREFIX}${targetUid}`,
              JSON.stringify(this.userState)
            );
          } catch {
            // ignore storage quota errors
          }
          return;
        } catch (err) {
          console.warn('[EchoSpeak] Failed to load signed-in user Firestore data:', err);
          try {
            const offlineMirror = localStorage.getItem(`${AUTH_USER_CACHE_PREFIX}${targetUid}`);
            if (offlineMirror) {
              const parsed = JSON.parse(offlineMirror) as Partial<UserScopedState>;
              this.userState = {
                users: parsed.users || [],
                user_scenario_progress: parsed.user_scenario_progress || [],
                user_srs_cards: parsed.user_srs_cards || [],
                user_practice_logs: parsed.user_practice_logs || [],
                user_playlists: parsed.user_playlists || [],
                user_playlist_items: parsed.user_playlist_items || [],
                user_ai_sessions: parsed.user_ai_sessions || [],
                user_gamification: parsed.user_gamification || null,
              };
              this.loadedForUid = targetUid;
              return;
            }
          } catch {
            // ignore storage errors
          }
        }
      }

      // Guest mode or offline fallback -> strictly localStorage (no unauthorized Firestore calls)
      try {
        const cached = localStorage.getItem(GUEST_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Partial<UserScopedState>;
          this.userState = {
            users: parsed.users || [],
            user_scenario_progress: parsed.user_scenario_progress || [],
            user_srs_cards: parsed.user_srs_cards || [],
            user_practice_logs: parsed.user_practice_logs || [],
            user_playlists: parsed.user_playlists || [],
            user_playlist_items: parsed.user_playlist_items || [],
            user_ai_sessions: parsed.user_ai_sessions || [],
            user_gamification: parsed.user_gamification || null,
          };
          this.loadedForUid = targetUid;
          return;
        }
      } catch {
        // ignore storage errors
      }

      this.userState = buildDefaultGuestState(cloneSeed());
      this.loadedForUid = targetUid;
      this.persistGuestState();
    })().finally(() => {
      this.userLoading = null;
    });

    return this.userLoading;
  }

  async ensureLoaded(): Promise<DatabaseState> {
    await this.ensurePublicLoaded();
    await this.ensureUserLoaded();
    const pub = this.publicContent!;
    const usr = this.userState!;

    return {
      content_sources: pub.content_sources,
      categories: pub.categories,
      scenarios: pub.scenarios,
      dialogues: pub.dialogues,
      dialogue_turns: pub.dialogue_turns,
      sentence_patterns: pub.sentence_patterns,
      expression_groups: pub.expression_groups,
      expressions: pub.expressions,
      vocabulary: pub.vocabulary,
      dialogue_turn_vocabulary: pub.dialogue_turn_vocabulary,
      cultural_notes: pub.cultural_notes,
      exercises: pub.exercises,
      users: usr.users,
      user_scenario_progress: usr.user_scenario_progress,
      user_srs_cards: usr.user_srs_cards,
      user_practice_logs: usr.user_practice_logs,
      listening_playlists: [...pub.system_playlists, ...usr.user_playlists],
      playlist_items: [...pub.system_playlist_items, ...usr.user_playlist_items],
    };
  }

  getUserScopedState(): UserScopedState {
    if (!this.userState) {
      this.userState = buildDefaultGuestState(cloneSeed());
    }
    return this.userState;
  }

  persistGuestState() {
    if (this.authUser || !this.userState) return;
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(this.userState));
    } catch {
      // ignore quota errors
    }
  }

  getBackendInfo(): { mode: 'firebase' | 'local'; projectId: string | null; note: string } {
    if (this.mode === 'firebase') {
      return {
        mode: 'firebase',
        projectId: this.projectId,
        note: this.authUser
          ? '已透過 Google 登入直連 Firebase Firestore（個人進度雲端隔離同步・公開教材唯讀保護）'
          : '已直連雲端教材 Firestore（教材公開唯讀・個人進度暫存於本機，登入 Google 即可雲端同步）',
      };
    }
    return {
      mode: 'local',
      projectId: this.projectId,
      note: '目前使用瀏覽器本機暫存（離線降級模式）',
    };
  }

  async saveUserDocs(
    col:
      | 'users'
      | 'user_scenario_progress'
      | 'user_srs_cards'
      | 'user_practice_logs'
      | 'listening_playlists'
      | 'playlist_items'
      | 'user_ai_sessions'
      | 'user_gamification',
    docs: Record<string, unknown>[]
  ): Promise<void> {
    if (!this.authUser) {
      this.persistGuestState();
      return;
    }
    if (this.mode !== 'firebase' || !firestore || docs.length === 0) return;

    const BATCH_LIMIT = 400;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(firestore);
      for (const item of chunk) {
        const clean = stripUndefined(item);
        const id = getDocId(clean);
        const ref = id ? doc(firestore, col, id) : doc(collection(firestore, col));
        batch.set(ref, clean, { merge: true });
      }
      await batch.commit();
    }
  }

  async saveAdminContentDocs(col: keyof DatabaseState, docs: Record<string, unknown>[]): Promise<void> {
    if (!this.isAdminUser()) {
      throw new Error('權限不足：公開版教材已啟用唯讀保護，僅管理員帳號或本機後端可寫入教材。');
    }
    if (this.mode !== 'firebase' || !firestore || docs.length === 0) return;

    const BATCH_LIMIT = 400;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(firestore);
      for (const item of chunk) {
        const clean = stripUndefined(item);
        const id = getDocId(clean);
        const ref = id ? doc(firestore, col, id) : doc(collection(firestore, col));
        batch.set(ref, clean, { merge: true });
      }
      await batch.commit();
    }
  }

  async removeUserDoc(col: 'user_srs_cards' | 'user_ai_sessions', id: string): Promise<void> {
    if (!this.authUser) {
      this.persistGuestState();
      return;
    }
    if (this.mode !== 'firebase' || !firestore) return;
    await deleteDoc(doc(firestore, col, id));
  }
}

const browserStore = new BrowserDataStore();

export function setFirestoreAuthUser(user: AuthUserInfo | null) {
  browserStore.setAuthUser(user);
}

function touchUserActivity(db: DatabaseState): UserProfile | null {
  const uid = browserStore.getActiveUserId();
  const user = db.users.find((u) => u.id === uid) || db.users[0] || null;
  if (!user) return null;
  const today = todayIsoDate();
  if (user.last_active_date !== today) {
    user.streak_days = (user.streak_days || 0) + 1;
    user.last_active_date = today;
  }
  return user;
}

export const firestoreApi = {
  async getHealth() {
    const db = await browserStore.ensureLoaded();
    return {
      ok: true,
      backend: browserStore.getBackendInfo(),
      counts: {
        scenarios: db.scenarios.length,
        dialogues: db.dialogues.length,
        turns: db.dialogue_turns.length,
        vocabulary: db.vocabulary.length,
        patterns: db.sentence_patterns.length,
        expressions: db.expressions.length,
        exercises: db.exercises.length,
        playlists: db.listening_playlists.length,
      },
    };
  },

  async getDashboard(): Promise<DashboardResponse> {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const user = db.users.find((u) => u.id === uid) || db.users[0];
    const now = new Date();
    const todayStr = todayIsoDate();

    const userLogs = db.user_practice_logs.filter((l) => l.user_id === user.id);
    const todaySeconds = userLogs
      .filter((l) => l.created_at.slice(0, 10) === todayStr)
      .reduce((sum, l) => sum + l.duration_seconds, 0);
    const listeningSeconds = userLogs
      .filter((l) => l.activity_type === 'loop_listening')
      .reduce((sum, l) => sum + l.duration_seconds, 0);

    const userSrs = db.user_srs_cards.filter((c) => c.user_id === user.id);
    const dueSrsCount = userSrs.filter((c) => new Date(c.next_review_at) <= now).length;

    const progressMap = new Map(
      db.user_scenario_progress
        .filter((p) => p.user_id === user.id)
        .map((p) => [p.scenario_id, p])
    );

    const goalCategoryMap: Record<string, string[]> = {
      travel_solo: [
        'cat-travel-airport',
        'cat-travel-hotel',
        'cat-travel-transport',
        'cat-travel-dining',
        'cat-shopping-tryon',
      ],
      travel_group: [
        'cat-shopping-tryon',
        'cat-travel-dining',
        'cat-travel-hotel',
        'cat-travel-airport',
      ],
      daily_life: [
        'cat-daily-morning',
        'cat-daily-kitchen',
        'cat-daily-health',
        'cat-social-park',
      ],
      small_talk: [
        'cat-social-park',
        'cat-social-weekend',
        'cat-social-phone',
        'cat-biz-meeting',
      ],
      workplace: [
        'cat-biz-meeting',
        'cat-biz-project',
        'cat-biz-schedule',
        'cat-biz-interview',
        'cat-social-phone',
      ],
    };
    const preferredCats = goalCategoryMap[user.learning_goal] || [];

    const recommended = [...db.scenarios]
      .filter((s) => s.is_published)
      .sort((a, b) => {
        const aMatch = preferredCats.includes(a.category_id) ? 0 : 1;
        const bMatch = preferredCats.includes(b.category_id) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        const aLvl = a.difficulty_level === user.current_level ? 0 : 1;
        const bLvl = b.difficulty_level === user.current_level ? 0 : 1;
        if (aLvl !== bLvl) return aLvl - bLvl;
        return a.sort_order - b.sort_order;
      })
      .slice(0, 4)
      .map((s) => ({
        ...s,
        category: db.categories.find((c) => c.id === s.category_id) || null,
        progress: progressMap.get(s.id) || null,
      }));

    const recentProgress = [...db.user_scenario_progress]
      .filter((p) => p.user_id === user.id)
      .sort((a, b) => b.last_studied_at.localeCompare(a.last_studied_at))[0];

    const continueScenario = recentProgress
      ? db.scenarios.find((s) => s.id === recentProgress.scenario_id) || recommended[0]
      : recommended[0];

    return {
      user,
      stats: {
        streak_days: user.streak_days,
        today_minutes: Math.round(todaySeconds / 60),
        listening_minutes: Math.round(listeningSeconds / 60),
        due_srs_count: dueSrsCount,
        total_srs_count: userSrs.length,
        completed_scenarios: db.user_scenario_progress.filter(
          (p) => p.user_id === user.id && p.completion_percent >= 100
        ).length,
        total_scenarios: db.scenarios.filter((s) => s.is_published).length,
      },
      continue_scenario: continueScenario
        ? { ...continueScenario, progress: progressMap.get(continueScenario.id) || null }
        : null,
      recommended_scenarios: recommended,
      backend: browserStore.getBackendInfo(),
    };
  },

  async updateProfile(body: Partial<UserProfile>) {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const user = db.users.find((u) => u.id === uid) || db.users[0];
    if (!user) throw new Error('User not found');

    if (body.display_name) user.display_name = String(body.display_name);
    if (body.current_level) user.current_level = body.current_level;
    if (body.learning_goal) user.learning_goal = body.learning_goal;
    if (body.preferred_accent) user.preferred_accent = body.preferred_accent;
    if (typeof body.daily_goal_minutes === 'number') {
      user.daily_goal_minutes = body.daily_goal_minutes;
    }

    await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
    return { user };
  },

  async getCategories() {
    const db = await browserStore.ensureLoaded();
    const roots = db.categories
      .filter((c) => !c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((root) => {
        const children = db.categories
          .filter((c) => c.parent_id === root.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const childIds = [root.id, ...children.map((c) => c.id)];
        const scenario_count = db.scenarios.filter(
          (s) => s.is_published && childIds.includes(s.category_id)
        ).length;
        return { ...root, children, scenario_count };
      });
    return { categories: roots, flat: db.categories };
  },

  async getScenarios(params?: Record<string, string>): Promise<{ scenarios: ScenarioListItem[] }> {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const { category, difficulty, travel_mode, search, survival_only } = params || {};

    let catIds: string[] | null = null;
    if (category && category !== 'all') {
      const target = db.categories.find((c) => c.slug === category || c.id === category);
      if (target) {
        const children = db.categories.filter((c) => c.parent_id === target.id).map((c) => c.id);
        catIds = [target.id, ...children];
      }
    }

    const progressMap = new Map(
      db.user_scenario_progress
        .filter((p) => p.user_id === uid)
        .map((p) => [p.scenario_id, p])
    );

    const items = db.scenarios
      .filter((s) => s.is_published)
      .filter((s) => !catIds || catIds.includes(s.category_id))
      .filter((s) => !difficulty || difficulty === 'all' || s.difficulty_level === difficulty)
      .filter((s) => !travel_mode || travel_mode === 'all' || s.travel_mode === travel_mode)
      .filter((s) => survival_only !== 'true' || s.is_survival_essential)
      .filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          s.title_zh.toLowerCase().includes(q) ||
          s.title_en.toLowerCase().includes(q) ||
          s.story_background.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => {
        const cat = db.categories.find((c) => c.id === s.category_id) || null;
        const parentCat = cat?.parent_id
          ? db.categories.find((c) => c.id === cat.parent_id) || null
          : null;
        const dialogues = db.dialogues.filter((d) => d.scenario_id === s.id);
        const patterns = db.sentence_patterns.filter((p) => p.scenario_id === s.id);
        const turnsCount = db.dialogue_turns.filter((t) =>
          dialogues.some((d) => d.id === t.dialogue_id)
        ).length;
        return {
          ...s,
          category: cat,
          parent_category: parentCat,
          dialogue_types: [...new Set(dialogues.map((d) => d.dialogue_type))],
          turns_count: turnsCount,
          patterns_count: patterns.length,
          progress: progressMap.get(s.id) || null,
        };
      });

    return { scenarios: items };
  },

  async getScenarioDetail(slug: string): Promise<ScenarioDetailResponse> {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const scenario = db.scenarios.find((s) => s.slug === slug || s.id === slug);
    if (!scenario) throw new Error('Scenario not found');

    const category = db.categories.find((c) => c.id === scenario.category_id) || null;
    const parentCategory = category?.parent_id
      ? db.categories.find((c) => c.id === category.parent_id) || null
      : null;

    const vocabMap = new Map(db.vocabulary.map((v) => [v.id, v]));

    const dialogues = db.dialogues
      .filter((d) => d.scenario_id === scenario.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => {
        const source = d.source_id
          ? db.content_sources.find((s) => s.id === d.source_id) || null
          : null;
        const turns = db.dialogue_turns
          .filter((t) => t.dialogue_id === d.id)
          .sort((a, b) => a.turn_order - b.turn_order)
          .map((t) => {
            const highlights = db.dialogue_turn_vocabulary
              .filter((dtv) => dtv.dialogue_turn_id === t.id)
              .map((dtv) => ({
                highlight_text: dtv.highlight_text,
                vocabulary: vocabMap.get(dtv.vocabulary_id)!,
              }))
              .filter((h) => Boolean(h.vocabulary));
            return { ...t, highlights };
          });
        return { ...d, source, turns };
      });

    const cultural_notes = db.cultural_notes
      .filter((n) => n.scenario_id === scenario.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const sentence_patterns = db.sentence_patterns.filter((p) => p.scenario_id === scenario.id);

    const exercises = db.exercises
      .filter((e) => e.scenario_id === scenario.id && e.exercise_type !== 'quick_response_3s')
      .sort((a, b) => a.sort_order - b.sort_order);

    const progress =
      db.user_scenario_progress.find((p) => p.user_id === uid && p.scenario_id === scenario.id) ||
      null;

    return {
      scenario,
      category,
      parent_category: parentCategory,
      dialogues,
      cultural_notes,
      sentence_patterns,
      exercises,
      progress,
    };
  },

  async updateScenarioProgress(
    scenarioId: string,
    body: {
      step1_blind_listen_done?: boolean;
      step2_study_done?: boolean;
      step3_shadowing_done?: boolean;
      step4_quiz_best_score?: number;
      duration_seconds?: number;
    }
  ) {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    let prog = usr.user_scenario_progress.find(
      (p) => p.user_id === uid && p.scenario_id === scenarioId
    );
    if (!prog) {
      prog = {
        id: `prog-${uid}-${scenarioId}`,
        user_id: uid,
        scenario_id: scenarioId,
        step1_blind_listen_done: false,
        step2_study_done: false,
        step3_shadowing_done: false,
        step4_quiz_best_score: 0,
        completion_percent: 0,
        last_studied_at: new Date().toISOString(),
      };
      usr.user_scenario_progress.push(prog);
    }

    if (typeof body.step1_blind_listen_done === 'boolean') {
      prog.step1_blind_listen_done = prog.step1_blind_listen_done || body.step1_blind_listen_done;
    }
    if (typeof body.step2_study_done === 'boolean') {
      prog.step2_study_done = prog.step2_study_done || body.step2_study_done;
    }
    if (typeof body.step3_shadowing_done === 'boolean') {
      prog.step3_shadowing_done = prog.step3_shadowing_done || body.step3_shadowing_done;
    }
    if (typeof body.step4_quiz_best_score === 'number') {
      prog.step4_quiz_best_score = Math.max(prog.step4_quiz_best_score, body.step4_quiz_best_score);
    }

    prog.completion_percent =
      (prog.step1_blind_listen_done ? 25 : 0) +
      (prog.step2_study_done ? 25 : 0) +
      (prog.step3_shadowing_done ? 25 : 0) +
      (prog.step4_quiz_best_score >= 60 ? 25 : 0);
    prog.last_studied_at = new Date().toISOString();

    const user = touchUserActivity(db);
    await browserStore.saveUserDocs('user_scenario_progress', [
      prog as unknown as Record<string, unknown>,
    ]);
    if (user) {
      await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
    }

    if (typeof body.duration_seconds === 'number' && body.duration_seconds > 0) {
      const log: UserPracticeLog = {
        id: randomId('log'),
        user_id: uid,
        activity_type: typeof body.step4_quiz_best_score === 'number' ? 'quiz' : 'shadowing',
        target_type: 'scenario',
        target_id: scenarioId,
        duration_seconds: body.duration_seconds,
        score: typeof body.step4_quiz_best_score === 'number' ? body.step4_quiz_best_score : null,
        detail_json: {},
        created_at: new Date().toISOString(),
      };
      usr.user_practice_logs.push(log);
      await browserStore.saveUserDocs('user_practice_logs', [
        log as unknown as Record<string, unknown>,
      ]);
    }

    return { progress: prog };
  },

  async getPlaylists(): Promise<{ playlists: HydratedPlaylist[] }> {
    const db = await browserStore.ensureLoaded();
    const playlists: HydratedPlaylist[] = db.listening_playlists.map((pl) => {
      const rawItems = db.playlist_items
        .filter((i) => i.playlist_id === pl.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const tracks = rawItems
        .map((item): HydratedPlaylistTrack | null => {
          if (item.item_type === 'dialogue_turn') {
            const t = db.dialogue_turns.find((x) => x.id === item.item_id);
            if (!t) return null;
            return {
              playlist_item_id: item.id,
              item_type: item.item_type,
              item_id: item.item_id,
              label: t.speaker_role,
              prompt_en: null,
              text_en: t.text_en,
              text_zh: t.text_zh,
              audio_normal_url: t.audio_normal_url,
              audio_slow_url: t.audio_slow_url,
              audio_zh_url: t.audio_zh_url,
            };
          }
          if (item.item_type === 'exercise') {
            const ex = db.exercises.find((x) => x.id === item.item_id);
            if (!ex) return null;
            return {
              playlist_item_id: item.id,
              item_type: item.item_type,
              item_id: item.item_id,
              label: ex.situation_tag || '3秒問答',
              prompt_en: ex.prompt_en || null,
              text_en: ex.correct_answer,
              text_zh: ex.correct_answer_zh || ex.prompt_text,
              audio_normal_url: ex.answer_audio_normal_url || null,
              audio_slow_url: ex.answer_audio_slow_url || null,
              audio_zh_url: ex.answer_audio_zh_url || null,
            };
          }
          return null;
        })
        .filter((x): x is HydratedPlaylistTrack => x !== null);

      return { ...pl, tracks };
    });

    return { playlists };
  },

  async createPlaylist(body: {
    title_zh: string;
    description?: string;
    item_ids: { item_type: string; item_id: string }[];
  }) {
    await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const playlist: ListeningPlaylist = {
      id: randomId('pl'),
      user_id: uid,
      title_zh: String(body.title_zh),
      description: body.description ? String(body.description) : null,
      is_system: false,
      playback_recipe_json: {
        name_zh: '經典三軌（常速 ➜ 慢速 ➜ 中文）',
        sequence: [
          { track: 'audio_normal_url', repeat: 1, pause_ms: 600 },
          { track: 'audio_slow_url', repeat: 1, pause_ms: 600 },
          { track: 'audio_zh_url', repeat: 1, pause_ms: 900 },
        ],
        loop_playlist: true,
      },
      created_at: new Date().toISOString(),
    };
    usr.user_playlists.push(playlist);
    await browserStore.saveUserDocs('listening_playlists', [
      playlist as unknown as Record<string, unknown>,
    ]);

    const newItems: PlaylistItem[] = [];
    if (Array.isArray(body.item_ids)) {
      body.item_ids.forEach((entry, idx) => {
        const pi: PlaylistItem = {
          id: randomId('pli'),
          playlist_id: playlist.id,
          item_type: entry.item_type as PlaylistItem['item_type'],
          item_id: entry.item_id,
          sort_order: idx + 1,
          is_system: false,
          user_id: uid,
        };
        usr.user_playlist_items.push(pi);
        newItems.push(pi);
      });
      if (newItems.length > 0) {
        await browserStore.saveUserDocs(
          'playlist_items',
          newItems as unknown as Record<string, unknown>[]
        );
      }
    }

    return { playlist };
  },

  async getQuick3sDrills(): Promise<{ drills: Exercise[] }> {
    const db = await browserStore.ensureLoaded();
    const drills = db.exercises
      .filter((e) => e.exercise_type === 'quick_response_3s')
      .sort((a, b) => a.sort_order - b.sort_order);
    return { drills };
  },

  async submitQuick3sResult(body: {
    exercise_id: string;
    rating: 'instant' | 'hesitated' | 'missed';
    duration_seconds?: number;
  }) {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const ex = db.exercises.find((e) => e.id === body.exercise_id);
    if (!ex) throw new Error('Exercise not found');

    const score = body.rating === 'instant' ? 100 : body.rating === 'hesitated' ? 60 : 20;
    const log: UserPracticeLog = {
      id: randomId('log'),
      user_id: uid,
      activity_type: 'quick_3s',
      target_type: null,
      target_id: body.exercise_id,
      duration_seconds: typeof body.duration_seconds === 'number' ? body.duration_seconds : 6,
      score,
      detail_json: { rating: body.rating },
      created_at: new Date().toISOString(),
    };
    usr.user_practice_logs.push(log);
    const user = touchUserActivity(db);
    await browserStore.saveUserDocs('user_practice_logs', [
      log as unknown as Record<string, unknown>,
    ]);
    if (user) {
      await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
    }

    let srsCard: UserSrsCard | null = null;
    if (body.rating === 'hesitated' || body.rating === 'missed') {
      const existing = usr.user_srs_cards.find(
        (c) => c.user_id === uid && c.item_type === 'exercise' && c.item_id === ex.id
      );
      if (existing) {
        Object.assign(existing, calculateSm2(existing, body.rating === 'missed' ? 0 : 3));
        srsCard = existing;
      } else {
        srsCard = {
          id: randomId('srs'),
          user_id: uid,
          item_type: 'exercise',
          item_id: ex.id,
          front_zh: `聽到「${ex.prompt_en}」➜ 回覆：${ex.prompt_text}`,
          back_en: ex.correct_answer,
          ipa: null,
          audio_url: ex.answer_audio_normal_url || null,
          personal_note: ex.explanation_zh || null,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          next_review_at: new Date().toISOString(),
          last_reviewed_at: null,
        };
        usr.user_srs_cards.push(srsCard);
      }
      await browserStore.saveUserDocs('user_srs_cards', [
        srsCard as unknown as Record<string, unknown>,
      ]);
    }

    return { ok: true, srs_added: Boolean(srsCard) };
  },

  async getPatterns(): Promise<{
    patterns: (SentencePattern & { scenario_title_zh: string; category: Category | null })[];
  }> {
    const db = await browserStore.ensureLoaded();
    const patterns = db.sentence_patterns.map((p) => {
      const scenario = db.scenarios.find((s) => s.id === p.scenario_id) || null;
      const category = scenario
        ? db.categories.find((c) => c.id === scenario.category_id) || null
        : null;
      return { ...p, scenario_title_zh: scenario?.title_zh || '', category };
    });
    return { patterns };
  },

  async getExpressions(): Promise<{
    groups: (ExpressionGroup & { expressions: Expression[] })[];
  }> {
    const db = await browserStore.ensureLoaded();
    const groups = db.expression_groups.map((g) => ({
      ...g,
      expressions: db.expressions
        .filter((e) => e.group_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
    return { groups };
  },

  async getSurvival() {
    const db = await browserStore.ensureLoaded();
    return {
      phrases: SURVIVAL_PHRASES,
      patterns: db.sentence_patterns.filter((p) => p.is_survival_essential),
    };
  },

  async getSrsCards() {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const now = new Date();
    const cards = db.user_srs_cards
      .filter((c) => c.user_id === uid)
      .sort((a, b) => a.next_review_at.localeCompare(b.next_review_at));
    const due_count = cards.filter((c) => new Date(c.next_review_at) <= now).length;
    return { cards, due_count };
  },

  async addSrsCard(body: {
    item_type: UserSrsCard['item_type'];
    item_id: string;
    front_zh: string;
    back_en: string;
    ipa?: string | null;
    audio_url?: string | null;
    personal_note?: string | null;
  }) {
    await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const existing = usr.user_srs_cards.find(
      (c) =>
        c.user_id === uid &&
        c.item_type === body.item_type &&
        c.item_id === String(body.item_id)
    );
    if (existing) return { card: existing, already_exists: true };

    const card: UserSrsCard = {
      id: randomId('srs'),
      user_id: uid,
      item_type: body.item_type,
      item_id: String(body.item_id),
      front_zh: String(body.front_zh),
      back_en: String(body.back_en),
      ipa: body.ipa || null,
      audio_url: body.audio_url || null,
      personal_note: body.personal_note || null,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
    };
    usr.user_srs_cards.push(card);
    await browserStore.saveUserDocs('user_srs_cards', [card as unknown as Record<string, unknown>]);
    return { card, already_exists: false };
  },

  async reviewSrsCard(id: string, quality: number) {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const card = usr.user_srs_cards.find((c) => c.id === id);
    if (!card) throw new Error('SRS card not found');

    Object.assign(card, calculateSm2(card, Number(quality ?? 4)));
    const log: UserPracticeLog = {
      id: randomId('log'),
      user_id: uid,
      activity_type: 'srs_review',
      target_type: null,
      target_id: card.id,
      duration_seconds: 15,
      score: Number(quality ?? 4) * 20,
      detail_json: { quality },
      created_at: new Date().toISOString(),
    };
    usr.user_practice_logs.push(log);
    const user = touchUserActivity(db);

    await browserStore.saveUserDocs('user_srs_cards', [card as unknown as Record<string, unknown>]);
    await browserStore.saveUserDocs('user_practice_logs', [
      log as unknown as Record<string, unknown>,
    ]);
    if (user) {
      await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
    }
    return { card };
  },

  async updateSrsNote(id: string, personal_note: string) {
    await browserStore.ensureLoaded();
    const usr = browserStore.getUserScopedState();
    const card = usr.user_srs_cards.find((c) => c.id === id);
    if (!card) throw new Error('SRS card not found');
    card.personal_note = personal_note;
    await browserStore.saveUserDocs('user_srs_cards', [card as unknown as Record<string, unknown>]);
    return { card };
  },

  async deleteSrsCard(id: string) {
    await browserStore.ensureLoaded();
    const usr = browserStore.getUserScopedState();
    const idx = usr.user_srs_cards.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('SRS card not found');
    const [removed] = usr.user_srs_cards.splice(idx, 1);
    await browserStore.removeUserDoc('user_srs_cards', removed.id);
    return { ok: true };
  },

  async logPractice(body: {
    activity_type: string;
    target_type?: string | null;
    target_id?: string | null;
    duration_seconds: number;
    score?: number | null;
    detail_json?: Record<string, unknown>;
  }) {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const log: UserPracticeLog = {
      id: randomId('log'),
      user_id: uid,
      activity_type: (body.activity_type || 'loop_listening') as UserPracticeLog['activity_type'],
      target_type: (body.target_type || null) as UserPracticeLog['target_type'],
      target_id: body.target_id || null,
      duration_seconds: Math.max(1, Number(body.duration_seconds || 60)),
      score: typeof body.score === 'number' ? body.score : null,
      detail_json: body.detail_json || {},
      created_at: new Date().toISOString(),
    };
    usr.user_practice_logs.push(log);
    const user = touchUserActivity(db);
    await browserStore.saveUserDocs('user_practice_logs', [
      log as unknown as Record<string, unknown>,
    ]);
    if (user) {
      await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
    }
    return { log };
  },

  async getAdminOverview(): Promise<{
    backend: { mode: 'firebase' | 'local'; projectId: string | null; note: string };
    sources: ContentSource[];
    collections: { name: string; count: number }[];
  }> {
    const db = await browserStore.ensureLoaded();
    const collections = Object.entries(db).map(([name, arr]) => ({
      name,
      count: Array.isArray(arr) ? arr.length : 0,
    }));
    return {
      backend: browserStore.getBackendInfo(),
      sources: db.content_sources,
      collections,
    };
  },

  async importAdminJson(payload: unknown) {
    if (!browserStore.isAdminUser()) {
      throw new Error('權限不足：公開版教材已啟用唯讀保護，僅管理員帳號或本機後端可執行批次匯入。');
    }

    const db = await browserStore.ensureLoaded();
    if (!payload || typeof payload !== 'object') throw new Error('Invalid JSON payload');

    const imported: Record<string, number> = {};
    const allowedKeys = [
      'content_sources',
      'categories',
      'scenarios',
      'dialogues',
      'dialogue_turns',
      'sentence_patterns',
      'expression_groups',
      'expressions',
      'vocabulary',
      'dialogue_turn_vocabulary',
      'cultural_notes',
      'exercises',
      'listening_playlists',
      'playlist_items',
    ] as const;

    const record = payload as Record<string, unknown>;
    for (const key of allowedKeys) {
      const incoming = record[key];
      if (!Array.isArray(incoming) || incoming.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetArr = db[key] as any[];
      const added: Record<string, unknown>[] = [];

      for (const item of incoming) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        const id = obj.id;
        const existingIdx = id ? targetArr.findIndex((x) => x.id === id) : -1;
        if (existingIdx >= 0) {
          targetArr[existingIdx] = { ...targetArr[existingIdx], ...obj };
        } else {
          targetArr.push(obj);
        }
        added.push(obj);
      }

      if (added.length > 0) {
        await browserStore.saveAdminContentDocs(key, added);
        imported[key] = added.length;
      }
    }

    return { ok: true, imported };
  },

  /* ===== Phase 2: AI Roleplay Sessions & Gamification ===== */

  async getAiSessions(): Promise<{ sessions: UserAiSession[] }> {
    await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const sessions = usr.user_ai_sessions
      .filter((s) => s.user_id === uid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { sessions };
  },

  async saveAiSession(
    body: Omit<UserAiSession, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ): Promise<{ session: UserAiSession }> {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const existingIdx = body.id
      ? usr.user_ai_sessions.findIndex((s) => s.id === body.id && s.user_id === uid)
      : -1;

    const session: UserAiSession = {
      id: body.id || randomId('aisess'),
      user_id: uid,
      scenario_id: body.scenario_id ?? null,
      scenario_title_zh: body.scenario_title_zh,
      scenario_title_en: body.scenario_title_en,
      ai_role: body.ai_role,
      user_role: body.user_role,
      difficulty_level: body.difficulty_level,
      missions: body.missions,
      completed_mission_indices: body.completed_mission_indices,
      messages: body.messages,
      report: body.report,
      duration_seconds: Math.max(10, Math.round(body.duration_seconds || 60)),
      created_at:
        existingIdx >= 0 ? usr.user_ai_sessions[existingIdx].created_at : new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      usr.user_ai_sessions[existingIdx] = session;
    } else {
      usr.user_ai_sessions.push(session);
    }

    await browserStore
      .saveUserDocs('user_ai_sessions', [session as unknown as Record<string, unknown>])
      .catch((err) => {
        console.warn('[EchoSpeak] Failed to sync user_ai_sessions to Firestore:', err);
      });

    // Also record into user_practice_logs when evaluated
    if (session.report) {
      const log: UserPracticeLog = {
        id: randomId('log'),
        user_id: uid,
        activity_type: 'ai_roleplay',
        target_type: session.scenario_id ? 'scenario' : null,
        target_id: session.scenario_id,
        duration_seconds: session.duration_seconds,
        score: session.report.overall_score,
        detail_json: {
          session_id: session.id,
          naturalness_score: session.report.naturalness_score,
          scenario_title_zh: session.scenario_title_zh,
        },
        created_at: new Date().toISOString(),
      };
      usr.user_practice_logs.push(log);
      const user = touchUserActivity(db);
      await browserStore.saveUserDocs('user_practice_logs', [
        log as unknown as Record<string, unknown>,
      ]);
      if (user) {
        await browserStore.saveUserDocs('users', [user as unknown as Record<string, unknown>]);
      }
    }

    return { session };
  },

  async deleteAiSession(id: string): Promise<{ ok: boolean }> {
    await browserStore.ensureLoaded();
    const usr = browserStore.getUserScopedState();
    const idx = usr.user_ai_sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      usr.user_ai_sessions.splice(idx, 1);
      await browserStore.removeUserDoc('user_ai_sessions', id).catch(() => {});
    }
    return { ok: true };
  },

  async getGamificationSnapshot(): Promise<GamificationInputs & { computed: ComputedGamification }> {
    const db = await browserStore.ensureLoaded();
    const uid = browserStore.getActiveUserId();
    const usr = browserStore.getUserScopedState();
    const user = db.users.find((u) => u.id === uid) || db.users[0];

    const inputs: GamificationInputs = {
      user,
      progress: usr.user_scenario_progress.filter((p) => p.user_id === uid),
      logs: usr.user_practice_logs.filter((l) => l.user_id === uid),
      srsCards: usr.user_srs_cards.filter((c) => c.user_id === uid),
      aiSessions: usr.user_ai_sessions.filter((s) => s.user_id === uid),
      saved: usr.user_gamification,
    };

    const computed = evaluateGamification(inputs);

    const prevDays = (usr.user_gamification?.challenge_7d.completed_days || []).join(',');
    const nextDays = computed.nextRecord.challenge_7d.completed_days.join(',');
    const changed =
      !usr.user_gamification ||
      computed.newlyUnlockedIds.length > 0 ||
      prevDays !== nextDays;

    if (changed) {
      usr.user_gamification = computed.nextRecord;
      await browserStore
        .saveUserDocs('user_gamification', [
          computed.nextRecord as unknown as Record<string, unknown>,
        ])
        .catch((err) => {
          console.warn('[EchoSpeak] Failed to sync user_gamification to Firestore:', err);
        });
    }

    return { ...inputs, saved: usr.user_gamification, computed };
  },

  async startTravelSprint(): Promise<{ gamification: UserGamification }> {
    const snap = await this.getGamificationSnapshot();
    const usr = browserStore.getUserScopedState();
    const record: UserGamification = {
      ...snap.computed.nextRecord,
      challenge_7d: {
        ...snap.computed.nextRecord.challenge_7d,
        started_at: snap.computed.nextRecord.challenge_7d.started_at || new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };
    usr.user_gamification = record;
    await browserStore
      .saveUserDocs('user_gamification', [record as unknown as Record<string, unknown>])
      .catch(() => {});
    return { gamification: record };
  },
};
