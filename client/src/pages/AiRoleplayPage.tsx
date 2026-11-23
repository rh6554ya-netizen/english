import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookmarkPlus,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  History,
  Keyboard,
  Lightbulb,
  Loader2,
  LogIn,
  MessageSquare,
  Mic,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { ROLEPLAY_PRESETS, type RoleplayPreset } from '../data/roleplayPresets';
import {
  aiApi,
  getAiApiBase,
  setCustomAiApiBase,
  type RoleplayContextPayload,
} from '../lib/aiApi';
import { api } from '../lib/api';
import { playAudio, stopAllAudio } from '../lib/audio';
import { useAuth } from '../lib/auth';
import {
  blobToBase64,
  createSpeechRecognition,
  isAudioRecordingSupported,
  isLiveSpeechRecognitionSupported,
  VoiceRecorder,
} from '../lib/recorder';
import type {
  AiQuotaStatus,
  AiRescueHint,
  AiRoleplayMessage,
  AiSessionReport,
  DifficultyLevel,
  UserAiSession,
} from '../../../shared/types';

type ViewMode = 'lobby' | 'chat' | 'report';

const LEVEL_META: { id: DifficultyLevel; label: string; desc: string }[] = [
  { id: 'zero_basis', label: '零基礎', desc: '短句慢速、友善引導' },
  { id: 'beginner', label: '初級實戰', desc: '日常旅遊高頻對話' },
  { id: 'intermediate', label: '道地進階', desc: '美式緩衝語氣與自然追問' },
];

const CAT_FILTERS = [
  { id: 'all', label: '全部 11 情境' },
  { id: 'travel', label: '✈️ 旅遊自保' },
  { id: 'shopping', label: '🛍️ 購物血拼' },
  { id: 'social', label: '💬 社交職場' },
  { id: 'daily', label: '🏡 生活日常' },
] as const;

const TONE_BADGE: Record<AiRescueHint['tone'], { label: string; cls: string }> = {
  simple: { label: '極簡救急', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  natural: { label: '道地自然', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  polite: { label: '禮貌進階', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function AiRoleplayPage() {
  const { user, signInWithGoogle } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Lobby & Config state
  const [view, setView] = useState<ViewMode>('lobby');
  const [categoryFilter, setCategoryFilter] = useState<(typeof CAT_FILTERS)[number]['id']>('all');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('星巴克客製化點咖啡');
  const [customAiRole, setCustomAiRole] = useState('Barista');
  const [customUserRole, setCustomUserRole] = useState('Customer');
  const [customSetting, setCustomSetting] = useState(
    'Ordering an iced oat milk latte with less ice at a busy coffee shop in Seattle.'
  );
  const [customMissionsText, setCustomMissionsText] = useState(
    '點一杯中杯冰燕麥拿鐵\n要求少冰並加購一份可頌\n詢問是否有提供無線網路密碼'
  );

  // Worker URL setup (fallback/local test helper)
  const [workerUrlInput, setWorkerUrlInput] = useState(getAiApiBase());
  const [showWorkerConfig, setShowWorkerConfig] = useState(false);

  // Quota & History
  const [quota, setQuota] = useState<AiQuotaStatus | null>(null);
  const [historySessions, setHistorySessions] = useState<UserAiSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Active Chat state
  const [activeContext, setActiveContext] = useState<RoleplayContextPayload | null>(null);
  const [messages, setMessages] = useState<AiRoleplayMessage[]>([]);
  const [completedMissions, setCompletedMissions] = useState<number[]>([]);
  const [rescueHints, setRescueHints] = useState<AiRescueHint[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [showZhMap, setShowZhMap] = useState<Record<string, boolean>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<Record<string, boolean>>({});
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [shouldWrapUp, setShouldWrapUp] = useState(false);
  const [sessionStartMs, setSessionStartMs] = useState<number>(Date.now());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Input / Audio recording / Dictation state
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [isDictating, setIsDictating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Report state
  const [report, setReport] = useState<AiSessionReport | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const dictationRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const recordingSupported = isAudioRecordingSupported();
  const dictationSupported = isLiveSpeechRecognitionSupported();
  const apiBaseConfigured = Boolean(getAiApiBase());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Load history & quota
  const loadLobbyData = async () => {
    const res = await api.getAiSessions();
    setHistorySessions(res.sessions);
    if (user && getAiApiBase()) {
      aiApi
        .getQuota()
        .then((q) => setQuota(q.quota))
        .catch(() => {});
    }
  };

  useEffect(() => {
    void loadLobbyData();
    return () => {
      stopAllAudio();
      recorderRef.current?.cancel();
      dictationRef.current?.stop();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, busy, view]);

  // Handle deep-link ?preset=rp-hotel
  const highlightedPresetId = searchParams.get('preset');

  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'all') return ROLEPLAY_PRESETS;
    return ROLEPLAY_PRESETS.filter((p) => p.category_tag === categoryFilter);
  }, [categoryFilter]);

  const speakAi = (text: string, slow = false) => {
    const rate = slow ? 0.75 : difficulty === 'zero_basis' ? 0.88 : 1.0;
    void playAudio({ fallbackText: text, lang: 'en-US', rate });
  };

  const handleSaveWorkerUrl = () => {
    setCustomAiApiBase(workerUrlInput);
    setShowWorkerConfig(false);
    showToast(workerUrlInput.trim() ? '已更新 AI Proxy 網址！' : '已清除自訂 Proxy 網址');
    void loadLobbyData();
  };

  const startSessionWithContext = async (ctx: RoleplayContextPayload) => {
    setError(null);
    if (!user) {
      setError('請先登入 Google 帳號以開始 AI 實境口說練習。');
      return;
    }
    if (!getAiApiBase()) {
      setShowWorkerConfig(true);
      setError('尚未設定 Cloudflare Worker AI Proxy 網址，請先完成部署或展開設定填入網址。');
      return;
    }

    stopAllAudio();
    setBusy(true);
    setBusyLabel('AI 角色進入情境中...');
    setActiveContext(ctx);
    setMessages([]);
    setCompletedMissions([]);
    setRescueHints([]);
    setShowHints(false);
    setShouldWrapUp(false);
    setReport(null);
    setActiveSessionId(null);
    setSessionStartMs(Date.now());
    setView('chat');

    try {
      const res = await aiApi.startRoleplay(ctx);
      setQuota(res.quota);
      const openingMsg: AiRoleplayMessage = {
        id: uid('msg'),
        role: 'ai',
        text_en: res.ai_reply_en,
        text_zh: res.ai_reply_zh,
        created_at: new Date().toISOString(),
      };
      setMessages([openingMsg]);
      setRescueHints(res.rescue_hints || []);
      if (autoSpeak) speakAi(res.ai_reply_en);
    } catch (err) {
      setError((err as Error).message);
      setView('lobby');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const handleStartPreset = (preset: RoleplayPreset) => {
    if (highlightedPresetId) setSearchParams({});
    void startSessionWithContext({
      scenario_id: preset.scenario_id,
      scenario_title_zh: preset.title_zh,
      scenario_title_en: preset.title_en,
      setting_background: preset.setting_background,
      ai_role: preset.ai_role,
      ai_persona: preset.ai_persona,
      user_role: preset.user_role,
      difficulty_level: difficulty,
      missions: preset.missions,
    });
  };

  const handleStartCustom = () => {
    const missions = customMissionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!customTitle.trim() || !customAiRole.trim() || missions.length === 0) {
      setError('請填寫情境名稱、AI 角色與至少 1 項對話目標。');
      return;
    }
    void startSessionWithContext({
      scenario_id: null,
      scenario_title_zh: customTitle.trim(),
      scenario_title_en: customTitle.trim(),
      setting_background: customSetting.trim() || customTitle.trim(),
      ai_role: customAiRole.trim(),
      ai_persona: 'Friendly, realistic native American English speaker.',
      user_role: customUserRole.trim() || 'You',
      difficulty_level: difficulty,
      missions,
    });
  };

  const sendTurn = async (opts: {
    userText?: string;
    audioBase64?: string;
    audioMimeType?: string;
  }) => {
    if (!activeContext || busy) return;
    setError(null);
    stopAllAudio();
    setBusy(true);
    setBusyLabel(opts.audioBase64 ? 'AI 正在聆聽你的語音並生成美式回饋...' : 'AI 思考回覆與自然度分析中...');

    const history = messages.map((m) => ({ role: m.role, text_en: m.text_en }));

    try {
      const res = await aiApi.sendRoleplayTurn({
        context: activeContext,
        history,
        userText: opts.userText || null,
        audioBase64: opts.audioBase64 || null,
        audioMimeType: opts.audioMimeType || null,
      });

      setQuota(res.quota);
      const userMsgId = uid('msg');
      const userMsg: AiRoleplayMessage = {
        id: userMsgId,
        role: 'user',
        text_en: res.transcript,
        used_audio: Boolean(opts.audioBase64),
        feedback: res.turn_feedback,
        created_at: new Date().toISOString(),
      };
      const aiMsg: AiRoleplayMessage = {
        id: uid('msg'),
        role: 'ai',
        text_en: res.ai_reply_en,
        text_zh: res.ai_reply_zh,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setExpandedFeedback((prev) => ({ ...prev, [userMsgId]: true }));
      setCompletedMissions((prev) => [
        ...new Set([...prev, ...(res.completed_mission_indices || [])]),
      ]);
      setRescueHints(res.rescue_hints || []);
      setShowHints(false);
      setShouldWrapUp(Boolean(res.should_wrap_up));
      setInputText('');

      if (autoSpeak) speakAi(res.ai_reply_en);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const handleSendText = () => {
    const clean = inputText.trim();
    if (!clean || busy) return;
    void sendTurn({ userText: clean });
  };

  const toggleAudioRecord = async () => {
    if (isRecording) {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setIsRecording(false);
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec) return;
      try {
        const audio = await rec.stop();
        URL.revokeObjectURL(audio.objectUrl);
        const base64 = await blobToBase64(audio.blob);
        await sendTurn({
          audioBase64: base64,
          audioMimeType: audio.mimeType,
          userText: inputText.trim() || undefined,
        });
      } catch (err) {
        setError((err as Error).message);
      }
      return;
    }

    setError(null);
    stopAllAudio();
    try {
      const rec = new VoiceRecorder();
      await rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      setRecordSec(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          if (s >= 44) {
            void toggleAudioRecord();
            return 45;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleLiveDictation = () => {
    if (isDictating) {
      dictationRef.current?.stop();
      setIsDictating(false);
      return;
    }
    setError(null);
    stopAllAudio();
    const rec = createSpeechRecognition({
      lang: 'en-US',
      onTranscript: (text) => setInputText(text),
      onError: (msg) => {
        setError(msg);
        setIsDictating(false);
      },
      onEnd: () => setIsDictating(false),
    });
    if (!rec) {
      setError('此瀏覽器不支援即時聽寫，請直接使用左側「錄音直傳 AI」按鈕！');
      return;
    }
    dictationRef.current = rec;
    setIsDictating(true);
    rec.start();
  };

  const handleFinishAndEvaluate = async () => {
    if (!activeContext || busy) return;
    const userTurns = messages.filter((m) => m.role === 'user');
    if (userTurns.length === 0) {
      setError('請先至少說或輸入 1 句英文對話，再結束產生總評報告！');
      return;
    }

    setError(null);
    stopAllAudio();
    setBusy(true);
    setBusyLabel('AI 教練正在整理你的道地美式總評報告...');

    try {
      const res = await aiApi.evaluateRoleplay({
        context: activeContext,
        messages: messages.map((m) => ({
          role: m.role,
          text_en: m.text_en,
          used_audio: m.used_audio,
        })),
      });
      setQuota(res.quota);
      const evalReport: AiSessionReport = {
        overall_score: res.overall_score,
        naturalness_score: res.naturalness_score,
        grammar_score: res.grammar_score,
        task_completion_score: res.task_completion_score,
        pronunciation_score: res.pronunciation_score,
        summary_zh: res.summary_zh,
        strengths_zh: res.strengths_zh,
        focus_areas_zh: res.focus_areas_zh,
        upgrade_cards: res.upgrade_cards,
      };
      setReport(evalReport);

      const durationSec = Math.max(20, Math.round((Date.now() - sessionStartMs) / 1000));
      const saved = await api.saveAiSession({
        id: activeSessionId || undefined,
        scenario_id: activeContext.scenario_id ?? null,
        scenario_title_zh: activeContext.scenario_title_zh,
        scenario_title_en: activeContext.scenario_title_en,
        ai_role: activeContext.ai_role,
        user_role: activeContext.user_role,
        difficulty_level: activeContext.difficulty_level,
        missions: activeContext.missions,
        completed_mission_indices: completedMissions,
        messages,
        report: evalReport,
        duration_seconds: durationSec,
      });
      setActiveSessionId(saved.session.id);

      // Evaluate gamification badges & 7-day sprint
      const gamif = await api.getGamificationSnapshot();
      if (gamif.computed.newlyUnlockedIds.length > 0) {
        const badgeNames = gamif.computed.badges
          .filter((b) => gamif.computed.newlyUnlockedIds.includes(b.id))
          .map((b) => `${b.emoji} ${b.title_zh}`)
          .join('、');
        showToast(`🎉 解鎖新成就：${badgeNames}！`);
      }

      await loadLobbyData();
      setView('report');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const handleSaveToSrs = async (opts: {
    front_zh: string;
    back_en: string;
    note?: string;
    keySeed: string;
  }) => {
    const res = await api.addSrsCard({
      item_type: 'ai_upgrade',
      item_id: `ai-${opts.keySeed.slice(0, 40)}`,
      front_zh: opts.front_zh,
      back_en: opts.back_en,
      personal_note: opts.note || null,
    });
    showToast(
      res.already_exists ? '這句美式表達已在你的 SRS 複習庫中！' : '⭐ 已收藏這句道地說法至 SRS 複習庫！'
    );
  };

  const openSavedSession = (sess: UserAiSession) => {
    setActiveContext({
      scenario_id: sess.scenario_id,
      scenario_title_zh: sess.scenario_title_zh,
      scenario_title_en: sess.scenario_title_en,
      setting_background: '',
      ai_role: sess.ai_role,
      ai_persona: '',
      user_role: sess.user_role,
      difficulty_level: sess.difficulty_level,
      missions: sess.missions,
    });
    setMessages(sess.messages);
    setCompletedMissions(sess.completed_mission_indices);
    setReport(sess.report);
    setActiveSessionId(sess.id);
    setView('report');
  };

  const handleDeleteSession = async (id: string) => {
    await api.deleteAiSession(id);
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    showToast('已刪除該筆 AI 對話紀錄');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl max-w-sm">
          {toast}
        </div>
      )}

      {/* ==================== LOBBY VIEW ==================== */}
      {view === 'lobby' && (
        <>
          {/* Hero */}
          <section className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 shadow-lg shadow-indigo-200/60">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold bg-white/15 backdrop-blur px-3 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Phase 2 · Groq Whisper ＋ Llama 3.3 極速語音口說教練</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  AI 實境口說角色扮演
                </h1>
                <p className="text-indigo-100 text-sm max-w-2xl leading-relaxed">
                  不用再照本宣科！選擇出國旅遊、購物或美式社交情境，直接按住開口說（相容 iPhone Safari 與 Android），每一句都能獲得即時「美式自然度改寫」與「卡關 3 句救場提示」。
                </p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                {quota && (
                  <div className="px-3.5 py-2 rounded-2xl bg-white/15 backdrop-blur border border-white/20 text-xs font-bold">
                    今日免費額度：剩餘{' '}
                    <span className="text-amber-300 text-sm">{quota.remaining}</span> / {quota.limit} 次
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition"
                  >
                    <History className="w-3.5 h-3.5" /> 過往紀錄（{historySessions.length}）
                  </button>
                  <button
                    onClick={() => setShowWorkerConfig((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition"
                    title="設定或切換 Cloudflare Worker AI Proxy 網址"
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Proxy 設定
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Auth Guard Banner */}
          {!user && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="font-extrabold text-amber-950 text-sm">
                  🔐 請先登入 Google 帳號以啟用免費 AI 口說額度
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  為防止 API 遭惡意濫用，Cloudflare Worker 會透過你的 Firebase Google 帳號核發每日 30 次免費額度，登入後所有對話報告也會自動雲端保存。
                </p>
              </div>
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm shrink-0 transition"
              >
                <LogIn className="w-4 h-4" /> Google 一鍵登入
              </button>
            </div>
          )}

          {/* Worker Proxy Config Panel */}
          {(showWorkerConfig || !apiBaseConfigured) && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  Cloudflare Worker AI Proxy 連線設定
                </div>
                {apiBaseConfigured && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    已設定連線
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                請填入你的 Cloudflare Worker 網址（例如{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                  https://echospeak-ai.&lt;subdomain&gt;.workers.dev
                </code>{' '}
                或本機測試{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                  http://localhost:8787
                </code>
                ）。正式部署時設定 <code className="font-mono">VITE_AI_API_BASE</code> 環境變數後，所有學員皆免設定直接使用。
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={workerUrlInput}
                  onChange={(e) => setWorkerUrlInput(e.target.value)}
                  placeholder="https://echospeak-ai.your-name.workers.dev"
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSaveWorkerUrl}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
                >
                  儲存網址
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-2.5 text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* History Drawer */}
          {showHistory && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" /> 你的 AI 口說練習紀錄
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  收起
                </button>
              </div>
              {historySessions.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  尚無已完成的 AI 實境對話紀錄，從下方挑選一個情境開始第一次開口吧！
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {historySessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="rounded-xl border border-slate-200 hover:border-indigo-300 p-3.5 flex items-center justify-between gap-3 transition"
                    >
                      <button
                        onClick={() => openSavedSession(sess)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {sess.scenario_title_zh}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{new Date(sess.created_at).toLocaleDateString('zh-TW')}</span>
                          <span>• {sess.messages.filter((m) => m.role === 'user').length} 輪發言</span>
                          {sess.report && (
                            <span className="font-bold text-indigo-600">
                              綜合 {sess.report.overall_score} 分 / 自然度{' '}
                              {sess.report.naturalness_score}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSession(sess.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="刪除紀錄"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Difficulty + Filter Bar */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">對話難度：</span>
                {LEVEL_META.map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setDifficulty(lvl.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                      difficulty === lvl.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCustomForm((v) => !v)}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                  showCustomForm
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                {showCustomForm ? '關閉自訂情境' : '✨ 自訂專屬對話情境'}
              </button>
            </div>

            {showCustomForm && (
              <div className="rounded-2xl bg-violet-50/70 border border-violet-200 p-4 sm:p-5 space-y-3">
                <div className="text-sm font-extrabold text-violet-950">建立你的客製化口說場景</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">情境名稱</label>
                    <input
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">AI 扮演角色</label>
                    <input
                      value={customAiRole}
                      onChange={(e) => setCustomAiRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">你扮演角色</label>
                    <input
                      value={customUserRole}
                      onChange={(e) => setCustomUserRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    場景背景描述（中英文皆可）
                  </label>
                  <input
                    value={customSetting}
                    onChange={(e) => setCustomSetting(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    通關任務清單（每行 1 項，最多 4 項）
                  </label>
                  <textarea
                    rows={3}
                    value={customMissionsText}
                    onChange={(e) => setCustomMissionsText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleStartCustom}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-sm transition"
                  >
                    <Sparkles className="w-4 h-4" /> 立即進入自訂實境對話
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {CAT_FILTERS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    categoryFilter === cat.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>

          {/* 11 Scenario Preset Cards */}
          <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPresets.map((preset) => {
              const isHighlighted = highlightedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 transition shadow-sm hover:shadow ${
                    isHighlighted
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-200/90 hover:border-indigo-300'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl">{preset.emoji}</span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        AI：{preset.ai_role}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{preset.title_zh}</h3>
                      <div className="text-xs font-semibold text-indigo-600 mt-0.5">
                        {preset.title_en}
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600 pt-1">
                      {preset.missions.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleStartPreset(preset)}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-bold transition shadow-sm"
                  >
                    <Mic className="w-4 h-4" /> 開始 AI 口說演練
                  </button>
                </div>
              );
            })}
          </section>
        </>
      )}

      {/* ==================== LIVE CHAT VIEW ==================== */}
      {view === 'chat' && activeContext && (
        <div className="space-y-4">
          {/* Top Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <button
                onClick={() => {
                  stopAllAudio();
                  setView('lobby');
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                title="返回大廳"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-extrabold text-slate-900 text-base">
                    {activeContext.scenario_title_zh}
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    對方：{activeContext.ai_role}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                  <span>
                    通關任務：{completedMissions.length}/{activeContext.missions.length}
                  </span>
                  {quota && <span>今日剩餘額度：{quota.remaining} 次</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  autoSpeak
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {autoSpeak ? '🔊 自動朗讀：開' : '🔇 自動朗讀：關'}
              </button>
              <button
                onClick={handleFinishAndEvaluate}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-xs font-extrabold shadow-sm transition"
              >
                <Award className="w-4 h-4" /> 結束並取得總評
              </button>
            </div>
          </div>

          {/* Missions Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 grid sm:grid-cols-3 gap-2">
            {activeContext.missions.map((mission, idx) => {
              const done = completedMissions.includes(idx);
              return (
                <div
                  key={idx}
                  className={`rounded-xl px-3 py-2 border text-xs flex items-start gap-2 transition ${
                    done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                      : 'bg-slate-50 border-slate-200/70 text-slate-600'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      done ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span>{mission}</span>
                </div>
              );
            })}
          </div>

          {shouldWrapUp && (
            <div className="rounded-2xl bg-emerald-600 text-white p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <span className="text-xs sm:text-sm font-bold">
                🎉 太棒了！你已經達成這個情境的全部實戰任務，可以隨時點擊「結束並取得總評」看美式口語升級清單！
              </span>
              <button
                onClick={handleFinishAndEvaluate}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-700 text-xs font-extrabold hover:bg-emerald-50"
              >
                查看總評報告 ➜
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Chat Feed */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4 min-h-[340px] max-h-[56vh] overflow-y-auto shadow-sm">
            {messages.map((msg) => {
              const isAi = msg.role === 'ai';
              const fb = msg.feedback;
              const isFbOpen = expandedFeedback[msg.id] ?? false;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-2`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${
                      isAi
                        ? 'bg-slate-100 text-slate-900 rounded-tl-sm'
                        : 'bg-indigo-600 text-white rounded-tr-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span
                        className={`text-[11px] font-bold flex items-center gap-1 ${
                          isAi ? 'text-indigo-700' : 'text-indigo-200'
                        }`}
                      >
                        {isAi ? (
                          <>
                            <Bot className="w-3.5 h-3.5" /> {activeContext.ai_role}
                          </>
                        ) : (
                          <>
                            {msg.used_audio ? '🎙️ 你（語音開口）' : '⌨️ 你（文字）'}
                          </>
                        )}
                      </span>
                      {isAi && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakAi(msg.text_en, false)}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 text-[11px] font-bold text-indigo-700 border border-slate-200 inline-flex items-center gap-1"
                          >
                            <Volume2 className="w-3 h-3" /> 朗讀
                          </button>
                          <button
                            onClick={() => speakAi(msg.text_en, true)}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 text-[11px] font-bold text-slate-600 border border-slate-200"
                          >
                            0.75x
                          </button>
                          {msg.text_zh && (
                            <button
                              onClick={() =>
                                setShowZhMap((p) => ({ ...p, [msg.id]: !p[msg.id] }))
                              }
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-600 border border-slate-200"
                            >
                              {showZhMap[msg.id] ? '隱藏中文' : '中文'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-sm sm:text-base font-semibold leading-relaxed">
                      {msg.text_en}
                    </div>

                    {isAi && msg.text_zh && showZhMap[msg.id] && (
                      <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/80">
                        {msg.text_zh}
                      </div>
                    )}
                  </div>

                  {/* Per-turn American Naturalness Feedback Card */}
                  {!isAi && fb && (
                    <div className="max-w-[92%] sm:max-w-[80%] w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                      <button
                        onClick={() =>
                          setExpandedFeedback((p) => ({ ...p, [msg.id]: !isFbOpen }))
                        }
                        className="w-full flex items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            美式自然度 {fb.naturalness_score} 分
                          </span>
                          <span className="text-xs font-bold text-amber-950 truncate">
                            🇺🇸 道地升級：{fb.native_upgrade_en}
                          </span>
                        </div>
                        {isFbOpen ? (
                          <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                        )}
                      </button>

                      {isFbOpen && (
                        <div className="pt-2 border-t border-amber-200/80 space-y-2 text-xs">
                          {fb.grammar_correction && (
                            <div className="bg-white/90 rounded-xl p-2.5 border border-rose-200 text-rose-900">
                              <span className="font-extrabold">✏️ 文法小修：</span>
                              {fb.grammar_correction}
                            </div>
                          )}

                          <div className="bg-white/90 rounded-xl p-2.5 border border-amber-200 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-extrabold text-indigo-700">
                                  🇺🇸 更像美國人的說法
                                </div>
                                <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                                  {fb.native_upgrade_en}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => speakAi(fb.native_upgrade_en, false)}
                                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                  title="試聽道地發音"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleSaveToSrs({
                                      front_zh: `${fb.native_upgrade_reason_zh}（原句：${msg.text_en}）`,
                                      back_en: fb.native_upgrade_en,
                                      note: `${activeContext.scenario_title_zh} AI 口說升級`,
                                      keySeed: fb.native_upgrade_en,
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  title="收藏這句至 SRS 複習庫"
                                >
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="text-slate-600 leading-relaxed">
                              {fb.native_upgrade_reason_zh}
                            </div>
                          </div>

                          {fb.pronunciation_tip_zh && (
                            <div className="bg-indigo-50 rounded-xl p-2.5 border border-indigo-200 text-indigo-900">
                              <span className="font-extrabold">🗣️ 發音／語調提醒：</span>
                              {fb.pronunciation_tip_zh}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2.5 rounded-2xl w-fit">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{busyLabel || 'AI 處理中...'}</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Rescue Hints Drawer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowHints((v) => !v)}
                disabled={rescueHints.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 text-xs font-extrabold transition"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                {showHints ? '收起救場提示' : '💡 卡關救場！看 3 句推薦回覆'}
              </button>
              <span className="text-[11px] text-slate-400">
                建議優先點擊「錄音開口」，AI 會極速辨識並回饋你的美式發音與自然度！
              </span>
            </div>

            {showHints && rescueHints.length > 0 && (
              <div className="grid md:grid-cols-3 gap-2.5">
                {rescueHints.map((hint, idx) => {
                  const badge = TONE_BADGE[hint.tone] || TONE_BADGE.natural;
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-amber-200 p-3 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakAi(hint.en, false)}
                            className="p-1 rounded-md hover:bg-slate-100 text-indigo-600"
                            title="聽這句怎麼唸"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setInputText(hint.en)}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-[10px] font-bold text-slate-700"
                          >
                            填入
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-snug">{hint.en}</div>
                      <div className="text-[11px] text-slate-500">{hint.zh}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dual-Track Voice & Text Input Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {recordingSupported && (
                <button
                  onClick={toggleAudioRecord}
                  disabled={busy || isDictating}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold transition shadow-sm ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-current" /> 停止並送出語音（{recordSec}s）
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" /> 錄音開口（直傳 AI 評發音）
                    </>
                  )}
                </button>
              )}

              {dictationSupported && (
                <button
                  onClick={toggleLiveDictation}
                  disabled={busy || isRecording}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-bold border transition ${
                    isDictating
                      ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isDictating ? '聽寫辨識中（點此停止）' : '即時聽寫轉文字'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  disabled={busy || isRecording}
                  placeholder="也可以直接輸入英文，或先聽寫再修改後按 Enter 送出..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleSendText}
                disabled={busy || isRecording || !inputText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-bold transition"
              >
                <Send className="w-4 h-4" /> 送出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUMMARY REPORT VIEW ==================== */}
      {view === 'report' && activeContext && report && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700 text-white p-6 sm:p-8 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 px-3 py-1 rounded-full">
                  <Award className="w-3.5 h-3.5 text-amber-300" /> AI 實境口說總評報告
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold">
                  {activeContext.scenario_title_zh}
                </h1>
                <p className="text-sm text-emerald-50 max-w-2xl leading-relaxed">
                  {report.summary_zh}
                </p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl p-4 text-center min-w-[130px]">
                <div className="text-xs font-bold text-emerald-100">綜合得分</div>
                <div className="text-4xl font-extrabold mt-1">{report.overall_score}</div>
                <div className="text-[11px] text-emerald-100 mt-0.5">滿分 100</div>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '美式自然度', val: report.naturalness_score, color: 'bg-indigo-600' },
              { label: '文法正確性', val: report.grammar_score, color: 'bg-emerald-600' },
              { label: '任務達成度', val: report.task_completion_score, color: 'bg-amber-500' },
              ...(report.pronunciation_score !== null
                ? [{ label: '語音發音表現', val: report.pronunciation_score, color: 'bg-violet-600' }]
                : [
                    {
                      label: '實戰任務完成',
                      val: Math.round(
                        (completedMissions.length / Math.max(1, activeContext.missions.length)) * 100
                      ),
                      color: 'bg-violet-600',
                    },
                  ]),
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-bold text-slate-500">{s.label}</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{s.val} 分</div>
                <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.val}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Strengths & Focus Areas */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-emerald-900 text-sm">🌟 本次亮點</h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                {report.strengths_zh.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-amber-900 text-sm">🎯 下次可以更道地</h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                {report.focus_areas_zh.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Native Upgrade Cards -> 1-Click SRS */}
          {report.upgrade_cards.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  🇺🇸 本次專屬「美式口語升級對照卡」
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  把最實用的道地說法一鍵加入 SRS 複習庫，系統會用 SM-2 演算法幫你自動排程複習！
                </p>
              </div>
              <div className="space-y-3">
                {report.upgrade_cards.map((card, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="text-xs text-slate-500">
                        你原本說：<span className="line-through">{card.user_said}</span>
                      </div>
                      <div className="text-base font-extrabold text-indigo-950">
                        {card.native_en}
                      </div>
                      <div className="text-xs font-semibold text-slate-700">{card.meaning_zh}</div>
                      <div className="text-xs text-indigo-700 bg-white/80 rounded-lg px-2.5 py-1.5 inline-block border border-indigo-100">
                        💡 {card.nuance_note_zh}
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => speakAi(card.native_en, false)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> 聽發音
                      </button>
                      <button
                        onClick={() =>
                          handleSaveToSrs({
                            front_zh: card.meaning_zh,
                            back_en: card.native_en,
                            note: `${card.nuance_note_zh}（原句：${card.user_said}）`,
                            keySeed: card.native_en,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" /> 加入 SRS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Transcript Review */}
          <details className="bg-white rounded-2xl border border-slate-200 p-5">
            <summary className="cursor-pointer font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> 展開完整對話逐字稿（{messages.length} 輪）
            </summary>
            <div className="mt-4 space-y-2.5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-sm ${
                    m.role === 'ai' ? 'bg-slate-50 text-slate-800' : 'bg-indigo-50 text-indigo-950'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-500 mb-0.5">
                    {m.role === 'ai' ? activeContext.ai_role : activeContext.user_role}
                  </div>
                  <div className="font-semibold">{m.text_en}</div>
                </div>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void startSessionWithContext(activeContext)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition"
            >
              <RotateCcw className="w-4 h-4" /> 同情境再練一次
            </button>
            <button
              onClick={() => setView('lobby')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" /> 返回情境大廳
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
