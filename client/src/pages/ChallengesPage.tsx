import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Flame,
  Lock,
  Plane,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ComputedGamification, GamificationInputs } from '../lib/gamification';

type BadgeCategory = 'all' | 'speaking' | 'listening' | 'habit' | 'challenge';

const BADGE_TABS: { id: BadgeCategory; label: string }[] = [
  { id: 'all', label: '全部成就' },
  { id: 'speaking', label: '🎙️ 口說實戰' },
  { id: 'listening', label: '🎧 聽力反應' },
  { id: 'habit', label: '🔥 學習習慣' },
  { id: 'challenge', label: '🏆 衝刺挑戰' },
];

export function ChallengesPage() {
  const [snapshot, setSnapshot] = useState<
    (GamificationInputs & { computed: ComputedGamification }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [badgeTab, setBadgeTab] = useState<BadgeCategory>('all');
  const [starting, setStarting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getGamificationSnapshot();
      setSnapshot(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleStartSprint = async () => {
    setStarting(true);
    try {
      await api.startTravelSprint();
      await load();
    } finally {
      setStarting(false);
    }
  };

  if (loading || !snapshot) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-3xl bg-slate-200" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const { computed, saved, user } = snapshot;
  const sprintPct = Math.round((computed.completedDaysCount / 7) * 100);
  const sprintStarted = Boolean(saved?.challenge_7d.started_at);
  const sprintGraduated = computed.completedDaysCount >= 7;

  const filteredBadges =
    badgeTab === 'all'
      ? computed.badges
      : computed.badges.filter((b) => b.category === badgeTab);

  return (
    <div className="space-y-7">
      {/* Hero Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white p-6 sm:p-8 shadow-lg shadow-orange-200/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
              <Plane className="w-3.5 h-3.5" />
              <span>7-Day Travel English Sprint · 出國前黃金衝刺</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              7 天旅遊英文衝刺營 ＆ 成就徽章
            </h1>
            <p className="text-amber-50 text-sm max-w-2xl leading-relaxed">
              從過海關、飯店 Check-in、餐廳過敏點餐到 AI 自由實戰驗收，系統會自動同步你在全站的學習紀錄與實戰分數。
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 text-center">
              <div className="text-[11px] font-bold text-amber-100">衝刺進度</div>
              <div className="text-2xl font-extrabold">{computed.completedDaysCount} / 7 天</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 text-center">
              <div className="text-[11px] font-bold text-amber-100">已解鎖徽章</div>
              <div className="text-2xl font-extrabold">
                {computed.unlockedCount} / {computed.badges.length}
              </div>
            </div>
          </div>
        </div>

        {/* Sprint Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>衝刺完成度：{sprintPct}%</span>
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-yellow-200" /> 目前連續打卡 {user.streak_days} 天
            </span>
          </div>
          <div className="h-3 bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${sprintPct}%` }}
            />
          </div>
        </div>

        {!sprintStarted && (
          <div className="mt-5">
            <button
              onClick={handleStartSprint}
              disabled={starting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-orange-700 hover:bg-amber-50 text-sm font-extrabold shadow-sm transition"
            >
              <Sparkles className="w-4 h-4" />
              {starting ? '啟動衝刺營中...' : '立即加入 7 天旅遊英文衝刺營'}
            </button>
          </div>
        )}
      </section>

      {/* Graduation Certificate Banner */}
      {sprintGraduated && (
        <section className="rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">
                Certificate of Completion
              </div>
              <h2 className="text-lg font-extrabold text-emerald-950 mt-0.5">
                🎉 恭喜 {user.display_name} 完成 7 天旅遊英文衝刺營！
              </h2>
              <p className="text-xs text-emerald-800 mt-1">
                你已具備出國自助行從機場、飯店、交通、點餐、血拼到緊急自保的完整英文口說實戰力！
              </p>
            </div>
          </div>
          <Link
            to="/ai-roleplay"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
          >
            繼續挑戰進階 AI 對話 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      )}

      {/* 7-Day Roadmap */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">7 日實戰任務地圖</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              可照順序完成，也可自由挑最需要的出國場景搶先通關
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {computed.days.map((d) => (
            <div
              key={d.day}
              className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition ${
                d.done
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-sm'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                      d.done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    Day {d.day}
                  </span>
                  {d.done ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> 已通關
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {d.progressText}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{d.title_zh}</h3>
                  <div className="text-xs font-semibold text-indigo-600 mt-0.5">
                    {d.subtitle_zh}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{d.task_desc_zh}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">{d.progressText}</span>
                <Link
                  to={d.action_to}
                  className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    d.done
                      ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {d.done ? '再次複習' : d.action_label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Achievement Badges Gallery */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> 學習成就徽章館
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              已收集 {computed.unlockedCount} / {computed.badges.length} 枚徽章
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BADGE_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setBadgeTab(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  badgeTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBadges.map((b) => {
            const pct = Math.min(100, Math.round((b.current / Math.max(1, b.target)) * 100));
            return (
              <div
                key={b.id}
                className={`rounded-2xl border p-4 space-y-3 transition ${
                  b.unlocked
                    ? 'bg-gradient-to-br from-amber-50/70 to-white border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200/80 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                      b.unlocked ? 'bg-amber-100' : 'bg-slate-100 grayscale'
                    }`}
                  >
                    {b.emoji}
                  </div>
                  {b.unlocked ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      已解鎖
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      <Lock className="w-3 h-3" /> 未解鎖
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{b.title_zh}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{b.desc_zh}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>
                      進度：{b.current} / {b.target}
                    </span>
                    {b.unlockedAt && (
                      <span className="text-amber-700">
                        {new Date(b.unlockedAt).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        b.unlocked ? 'bg-amber-500' : 'bg-indigo-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
