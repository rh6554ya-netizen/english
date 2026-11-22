import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Columns2, Search, ShieldAlert, Volume2 } from 'lucide-react';
import { api, type ScenarioListItem } from '../lib/api';
import { playAudio } from '../lib/audio';
import {
  countCachedPaths,
  getCachedAudioUrlSet,
  getScenarioAudioPaths,
  isCacheApiSupported,
} from '../lib/offlineCache';
import type { Category, SentencePattern } from '../../../shared/types';

const DIFF_LABELS: Record<string, string> = {
  zero_basis: '零基礎',
  beginner: '初級實戰',
  intermediate: '道地進階',
};

const TRAVEL_LABELS: Record<string, string> = {
  general: '通用',
  solo_travel: '自助行',
  group_tour: '跟團適用',
};

export function ScenariosPage() {
  const [categories, setCategories] = useState<(Category & { scenario_count: number })[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [patterns, setPatterns] = useState<SentencePattern[]>([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [travelMode, setTravelMode] = useState('all');
  const [search, setSearch] = useState('');
  const [roleSplitOpen, setRoleSplitOpen] = useState(false);
  const [cachedAudioSet, setCachedAudioSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getCategories().then((r) => setCategories(r.categories));
    api.getPatterns().then((r) => setPatterns(r.patterns));
    if (isCacheApiSupported()) {
      getCachedAudioUrlSet().then(setCachedAudioSet);
    }
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedCat !== 'all') params.category = selectedCat;
    if (difficulty !== 'all') params.difficulty = difficulty;
    if (travelMode !== 'all') params.travel_mode = travelMode;
    if (search.trim()) params.search = search.trim();
    api.getScenarios(params).then((r) => setScenarios(r.scenarios));
  }, [selectedCat, difficulty, travelMode, search]);

  const staffPatterns = patterns.filter((p) => p.speaker_role === 'Shop Assistant');
  const customerPatterns = patterns.filter(
    (p) => p.speaker_role === 'Customer' || p.speaker_role === 'Traveler'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">情境主題課程館</h1>
          <p className="text-sm text-slate-500 mt-1">
            依四大領域、難度與旅遊模式瀏覽實戰課程，支援角色雙向對照視圖
          </p>
        </div>
        <button
          onClick={() => setRoleSplitOpen((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${
            roleSplitOpen
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
          }`}
        >
          <Columns2 className="w-4 h-4" />
          {roleSplitOpen ? '返回課程列表' : '店員 vs. 顧客雙向對照表'}
        </button>
      </div>

      {roleSplitOpen ? (
        <section className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-extrabold text-slate-900">👂 你可能會聽到（店員 / 對方用語）</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Shop Assistant
              </span>
            </div>
            {staffPatterns.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{p.example_en}</div>
                  <div className="text-xs text-slate-600 mt-1">{p.example_zh}</div>
                  {p.pragmatic_note && (
                    <div className="text-[11px] text-slate-400 mt-1">{p.pragmatic_note}</div>
                  )}
                </div>
                <button
                  onClick={() =>
                    playAudio({ url: p.audio_normal_url, fallbackText: p.example_en })
                  }
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 shrink-0"
                  title="播放常速"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
              <h2 className="font-extrabold text-indigo-900">🗣️ 你可以這樣回覆（顧客 / 旅客）</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                You / Traveler
              </span>
            </div>
            {customerPatterns.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{p.example_en}</div>
                  <div className="text-xs text-slate-600 mt-1">{p.example_zh}</div>
                  {p.pragmatic_note && (
                    <div className="text-[11px] text-indigo-600/80 mt-1">{p.pragmatic_note}</div>
                  )}
                </div>
                <button
                  onClick={() =>
                    playAudio({ url: p.audio_normal_url, fallbackText: p.example_en })
                  }
                  className="p-2 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-600 shrink-0 transition"
                  title="播放常速"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                selectedCat === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
              }`}
            >
              全部領域
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.slug)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  selectedCat === cat.slug
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                }`}
              >
                {cat.icon} {cat.name_zh} ({cat.scenario_count})
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋情境關鍵字（如：機場、過敏、試穿、公園）..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700"
            >
              <option value="all">全部難度</option>
              <option value="zero_basis">零基礎</option>
              <option value="beginner">初級實戰</option>
              <option value="intermediate">道地進階</option>
            </select>

            <select
              value={travelMode}
              onChange={(e) => setTravelMode(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700"
            >
              <option value="all">全部模式</option>
              <option value="solo_travel">自助行推薦</option>
              <option value="group_tour">跟團適用</option>
              <option value="general">日常通用</option>
            </select>
          </div>

          {/* Scenarios Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {scenarios.map((scn) => {
              const pct = scn.progress?.completion_percent ?? 0;
              const scnAudio = getScenarioAudioPaths(scn.id);
              const isOfflineReady =
                scnAudio.length > 0 && countCachedPaths(scnAudio, cachedAudioSet) >= scnAudio.length;
              return (
                <Link
                  key={scn.id}
                  to={`/studio/${scn.slug}`}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-400 p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        {scn.category?.icon} {scn.category?.name_zh}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isOfflineReady && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> 離線
                          </span>
                        )}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {DIFF_LABELS[scn.difficulty_level]}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {TRAVEL_LABELS[scn.travel_mode]}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base mt-3 leading-snug">
                      {scn.title_zh}
                    </h3>
                    <div className="text-xs font-semibold text-indigo-600 mt-0.5">
                      {scn.title_en}
                    </div>
                    <p className="text-xs text-slate-500 mt-2.5 leading-relaxed line-clamp-3">
                      {scn.story_background}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {scn.turns_count} 句對話・{scn.estimated_minutes} 分鐘
                      </span>
                      {scn.is_survival_essential && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" /> 急救必備
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-9 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
