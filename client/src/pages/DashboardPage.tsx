import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Clock,
  Flame,
  Headphones,
  Layers,
  LifeBuoy,
  Play,
  SlidersHorizontal,
  Trophy,
  Zap,
} from 'lucide-react';
import { api, type DashboardResponse } from '../lib/api';
import type { DifficultyLevel, LearningGoal } from '../../../shared/types';

const GOAL_OPTIONS: { value: LearningGoal; label: string; desc: string }[] = [
  { value: 'travel_solo', label: '✈️ 出國自助行', desc: '機場、海關、餐廳點餐、問路自保' },
  { value: 'travel_group', label: '🛍️ 跟團救急血拼', desc: '自由活動逛街、試穿退換貨、必備急救句' },
  { value: 'daily_life', label: '🏡 零基礎生活日常', desc: '起床到就寢 500 句迷你對話與動詞片語' },
  { value: 'small_talk', label: '💬 美式社交與職場', desc: '偶遇閒聊不句點、緩衝語氣與電話轉接' },
];

const LEVEL_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: 'zero_basis', label: '零基礎（慢速＋音標）' },
  { value: 'beginner', label: '初級實戰（旅遊＆模板）' },
  { value: 'intermediate', label: '道地進階（緩衝＆美式接話）' },
];

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdatePrefs = async (patch: {
    learning_goal?: LearningGoal;
    current_level?: DifficultyLevel;
  }) => {
    setSaving(true);
    try {
      await api.updateProfile(patch);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { user, stats, continue_scenario, recommended_scenarios } = data;

  return (
    <div className="space-y-7">
      {/* Hero Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-6 sm:p-8 shadow-lg shadow-indigo-200/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 backdrop-blur px-3 py-1 rounded-full">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>已連續學習 {stats.streak_days} 天</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3">
              嗨，{user.display_name}！今天也來開口說道地美語
            </h1>
            <p className="text-indigo-100 text-sm sm:text-base mt-2 max-w-xl">
              目前目標：
              <strong className="text-white">
                {GOAL_OPTIONS.find((g) => g.value === user.learning_goal)?.label}
              </strong>{' '}
              ・ 程度：
              <strong className="text-white">
                {LEVEL_OPTIONS.find((l) => l.value === user.current_level)?.label}
              </strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setShowOnboarding((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
              調整學習目標
            </button>
            {continue_scenario && (
              <Link
                to={`/studio/${continue_scenario.slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-bold shadow-sm transition"
              >
                <Play className="w-4 h-4 fill-current" />
                繼續上次情境
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Onboarding Goal & Level Customizer */}
      {showOnboarding && (
        <section className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">個人化情境目標與程度引導</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                選擇後會立即為你重新排序下方推薦課程路徑
              </p>
            </div>
            {saving && <span className="text-xs text-indigo-600 font-semibold">儲存中...</span>}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.value}
                onClick={() => handleUpdatePrefs({ learning_goal: g.value })}
                className={`text-left p-3.5 rounded-xl border transition ${
                  user.learning_goal === g.value
                    ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm text-slate-900">{g.label}</div>
                <div className="text-xs text-slate-500 mt-1">{g.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 mr-2">目前程度：</span>
            {LEVEL_OPTIONS.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => handleUpdatePrefs({ current_level: lvl.value })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  user.current_level === lvl.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>連續打卡 Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {stats.streak_days} <span className="text-sm font-medium text-slate-500">天</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>今日學習時長</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {stats.today_minutes}{' '}
            <span className="text-sm font-medium text-slate-500">
              / {user.daily_goal_minutes} 分鐘
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>磨耳朵累積時數</span>
            <Headphones className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {stats.listening_minutes}{' '}
            <span className="text-sm font-medium text-slate-500">分鐘</span>
          </div>
        </div>

        <Link
          to="/srs"
          className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 p-5 transition group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>今日待複習 SRS</span>
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 flex items-baseline gap-2">
            <span>{stats.due_srs_count}</span>
            <span className="text-sm font-medium text-slate-500">
              張到期（共 {stats.total_srs_count} 張）
            </span>
          </div>
        </Link>
      </section>

      {/* Phase 2 Featured Entry: AI Roleplay + 7-Day Sprint */}
      <section className="grid md:grid-cols-2 gap-4">
        <Link
          to="/ai-roleplay"
          className="group rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base">AI 實境口說角色扮演</h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                NEW
              </span>
            </div>
            <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
              直接語音開口與 AI 模擬機場、餐廳、購物與美式閒聊，獲得即時自然度評分、救場提示與 SRS 升級卡。
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
        </Link>

        <Link
          to="/challenges"
          className="group rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base">7 天旅遊英文衝刺 ＆ 成就</h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
                12 枚徽章
              </span>
            </div>
            <p className="text-xs text-amber-50 mt-1 leading-relaxed">
              出國前 7 天每日實戰清單自動同步進度，解鎖口說、發音與連勝成就徽章。
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
        </Link>
      </section>

      {/* Quick Action Cards */}
      <section className="grid md:grid-cols-3 gap-4">
        <Link
          to="/quick-drill"
          className="group bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 p-5 flex items-start gap-4 transition shadow-sm hover:shadow"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 group-hover:text-amber-700 transition">
              3 秒直覺反應快問快答
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              聽提問 ➜ 3 秒倒數開口 ➜ 揭示道地回覆，卡關自動排入 SRS 複習。
            </p>
          </div>
        </Link>

        <Link
          to="/loop-player"
          className="group bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 p-5 flex items-start gap-4 transition shadow-sm hover:shadow"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition">
              磨耳朵循環播放器
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              常速 ➜ 慢速 ➜ 中文三軌循環播放，支援睡眠定時與背景音訊控制。
            </p>
          </div>
        </Link>

        <Link
          to="/survival"
          className="group bg-white rounded-2xl border border-slate-200/80 hover:border-rose-300 p-5 flex items-start gap-4 transition shadow-sm hover:shadow"
        >
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 group-hover:text-rose-700 transition">
              出國與緊急隨身急救卡
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              過海關、堅果過敏、遺失護照、叫救護車大字體卡片與一鍵語音播放。
            </p>
          </div>
        </Link>
      </section>

      {/* Recommended Scenarios */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">為你推薦的四步驟實戰情境</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              依你的目標與程度精選，每課皆含：純聽 ➜ 雙語精讀 ➜ 角色扮演跟讀 ➜ 反向測驗
            </p>
          </div>
          <Link
            to="/scenarios"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            全部課程 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {recommended_scenarios.map((scn) => {
            const pct = scn.progress?.completion_percent ?? 0;
            return (
              <Link
                key={scn.id}
                to={`/studio/${scn.slug}`}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 p-5 transition shadow-sm hover:shadow flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {scn.category?.icon} {scn.category?.name_zh}
                    </span>
                    <span className="text-xs text-slate-500">約 {scn.estimated_minutes} 分鐘</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-3">{scn.title_zh}</h3>
                  <div className="text-xs font-medium text-indigo-600 mt-0.5">{scn.title_en}</div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {scn.story_background}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">四步驟完成度</span>
                    <span className="font-bold text-indigo-600">{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
