import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Play, RotateCcw, Shuffle, Volume2, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { playAudio, stopAllAudio } from '../lib/audio';
import type { Exercise } from '../../../shared/types';

type Phase = 'idle' | 'listening_q' | 'countdown' | 'revealed' | 'finished';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function QuickDrillPage() {
  const [allDrills, setAllDrills] = useState<Exercise[]>([]);
  const [sessionDrills, setSessionDrills] = useState<Exercise[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sessionLimit, setSessionLimit] = useState<number>(10);
  const [shuffleEnabled, setShuffleEnabled] = useState<boolean>(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState({ instant: 0, hesitated: 0, missed: 0 });
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const [srsNotice, setSrsNotice] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    api.getQuick3sDrills().then((r) => setAllDrills(r.drills));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAllAudio();
    };
  }, []);

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of allDrills) {
      const tag = d.situation_tag || '日常會話';
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([tag, count]) => ({ tag, count }));
  }, [allDrills]);

  const filteredPool = useMemo(() => {
    if (selectedTag === 'all') return allDrills;
    return allDrills.filter((d) => (d.situation_tag || '日常會話') === selectedTag);
  }, [allDrills, selectedTag]);

  const current = sessionDrills[index];

  const startQuestion = async (idx: number, queue: Exercise[]) => {
    const item = queue[idx];
    if (!item) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIndex(idx);
    setSrsNotice(false);
    setPhase('listening_q');
    setCountdown(3);

    await playAudio({
      url: item.prompt_audio_url,
      fallbackText: item.prompt_en || item.prompt_text,
    });

    setPhase('countdown');
    let left = 3;
    setCountdown(3);
    timerRef.current = window.setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        revealAnswer(item);
      }
    }, 1000);
  };

  const startNewSession = (customQueue?: Exercise[]) => {
    const base = customQueue
      ? [...customQueue]
      : shuffleEnabled
      ? shuffleArray(filteredPool)
      : [...filteredPool];
    const picked =
      customQueue || sessionLimit === 0 ? base : base.slice(0, Math.min(sessionLimit, base.length));
    if (picked.length === 0) return;

    setSessionDrills(picked);
    setStats({ instant: 0, hesitated: 0, missed: 0 });
    setMissedIds([]);
    startQuestion(0, picked);
  };

  const revealAnswer = async (item: Exercise) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('revealed');
    await playAudio({
      url: item.answer_audio_normal_url,
      fallbackText: item.correct_answer,
    });
  };

  const handleRate = async (rating: 'instant' | 'hesitated' | 'missed') => {
    if (!current) return;
    const res = await api.submitQuick3sResult({
      exercise_id: current.id,
      rating,
      duration_seconds: 8,
    });
    setStats((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));
    if (rating === 'hesitated' || rating === 'missed') {
      setMissedIds((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
    }
    if (res.srs_added) setSrsNotice(true);

    if (index + 1 < sessionDrills.length) {
      startQuestion(index + 1, sessionDrills);
    } else {
      setPhase('finished');
    }
  };

  const handleBackToSetup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAllAudio();
    setPhase('idle');
  };

  if (!allDrills.length) {
    return <div className="p-12 text-center text-slate-500">載入 3 秒題庫中...</div>;
  }

  const activeCount = phase === 'idle' ? filteredPool.length : sessionDrills.length;
  const progressPct =
    phase === 'idle' || sessionDrills.length === 0
      ? 0
      : phase === 'finished'
      ? 100
      : Math.round(((index + 1) / sessionDrills.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            「3 秒直覺反應」高頻 Q&A 訓練
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            完整收錄 {allDrills.length} 組真實美式問答・聽見提問 ➜ 3 秒倒數開口 ➜ 卡關自動寫入 SRS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'idle' && (
            <button
              onClick={handleBackToSetup}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              重新選題
            </button>
          )}
          <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {phase === 'idle'
              ? `題庫 ${activeCount} 題`
              : `${Math.min(index + 1, sessionDrills.length)} / ${sessionDrills.length}`}
          </div>
        </div>
      </div>

      {phase !== 'idle' && (
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {phase === 'idle' && (
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Zap className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              自由選擇場合與題數，挑戰 3 秒直覺開口！
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              系統先唸出對方提問，接著啟動 <strong>3 秒倒數</strong>。請看中文提示不假思索脫口而出，時間到自動揭曉道地回答並播放發音。
            </p>
          </div>

          {/* Situation Tag Filter */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-500">1. 選擇訓練場合</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedTag === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全部場合 ({allDrills.length})
              </button>
              {tagOptions.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => setSelectedTag(item.tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedTag === item.tag
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.tag} ({item.count})
                </button>
              ))}
            </div>
          </div>

          {/* Session Size & Shuffle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500">2. 本輪題數</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 10, label: '10 題衝刺' },
                  { value: 20, label: '20 題進階' },
                  { value: 0, label: `全部 (${filteredPool.length} 題)` },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSessionLimit(opt.value)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                      sessionLimit === opt.value
                        ? 'bg-amber-50 border-amber-400 text-amber-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShuffleEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition self-start sm:self-end ${
                shuffleEnabled
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              {shuffleEnabled ? '隨機出題：開' : '依序出題'}
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => startNewSession()}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-md shadow-amber-200 transition"
            >
              <Play className="w-5 h-5 fill-current" /> 開始{' '}
              {sessionLimit === 0
                ? filteredPool.length
                : Math.min(sessionLimit, filteredPool.length)}{' '}
              題極限反應訓練
            </button>
          </div>
        </section>
      )}

      {(phase === 'listening_q' || phase === 'countdown' || phase === 'revealed') && current && (
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              場合：{current.situation_tag || '日常會話'}
            </span>
            <button
              onClick={() =>
                playAudio({
                  url: current.prompt_audio_url,
                  fallbackText: current.prompt_en || '',
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <Volume2 className="w-4 h-4" /> 重聽提問
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-bold text-slate-400 uppercase">對方提問 (Question)</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{current.prompt_en}</div>
          </div>

          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-3">
            <div className="text-xs font-bold text-amber-700">你要在 3 秒內說出：</div>
            <div className="text-lg font-extrabold text-slate-900">「{current.prompt_text}」</div>

            {phase === 'listening_q' && (
              <div className="text-xs font-semibold text-indigo-600 animate-pulse">
                🔊 正在播放提問...
              </div>
            )}

            {phase === 'countdown' && (
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="w-20 h-20 rounded-full border-4 border-amber-500 flex items-center justify-center text-3xl font-extrabold text-amber-600 bg-white shadow-inner">
                  {countdown}
                </div>
                <button
                  onClick={() => revealAnswer(current)}
                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline"
                >
                  已開口，立即揭曉答案
                </button>
              </div>
            )}
          </div>

          {phase === 'revealed' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">道地美式回覆</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        playAudio({
                          url: current.answer_audio_normal_url,
                          fallbackText: current.correct_answer,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-800"
                    >
                      🔊 常速
                    </button>
                    <button
                      onClick={() =>
                        playAudio({
                          url: current.answer_audio_slow_url,
                          fallbackText: current.correct_answer,
                          rate: 0.75,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-800"
                    >
                      🐢 慢速
                    </button>
                  </div>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {current.correct_answer}
                </div>
                {current.explanation_zh && (
                  <p className="text-xs text-emerald-900/80 leading-relaxed pt-1">
                    💡 {current.explanation_zh}
                  </p>
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-slate-500 text-center mb-2.5">
                  自評剛剛的反應速度（選「卡關 / 不會」將自動排入 SRS 複習）
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleRate('instant')}
                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition"
                  >
                    ⚡ 秒答成功
                  </button>
                  <button
                    onClick={() => handleRate('hesitated')}
                    className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition"
                  >
                    🤔 有點卡關
                  </button>
                  <button
                    onClick={() => handleRate('missed')}
                    className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition"
                  >
                    😵 說不出來
                  </button>
                </div>
              </div>
            </div>
          )}

          {srsNotice && (
            <div className="text-xs text-center text-indigo-600 font-semibold">
              已將上一題自動排入 SRS 間隔重複複習庫！
            </div>
          )}
        </section>
      )}

      {phase === 'finished' && (
        <section className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-5 shadow-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-extrabold text-slate-900">本輪 3 秒反應訓練完成！</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-emerald-50">
              <div className="text-2xl font-extrabold text-emerald-700">{stats.instant}</div>
              <div className="text-xs font-bold text-emerald-600 mt-1">⚡ 秒答</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50">
              <div className="text-2xl font-extrabold text-amber-700">{stats.hesitated}</div>
              <div className="text-xs font-bold text-amber-600 mt-1">🤔 卡關</div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50">
              <div className="text-2xl font-extrabold text-rose-700">{stats.missed}</div>
              <div className="text-xs font-bold text-rose-600 mt-1">😵 不會</div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            所有標記為「卡關」或「不會」的題目都已自動加入 SRS 複習庫。
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {missedIds.length > 0 && (
              <button
                onClick={() =>
                  startNewSession(allDrills.filter((d) => missedIds.includes(d.id)))
                }
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm"
              >
                <Zap className="w-4 h-4" /> 只重練本輪卡關題 ({missedIds.length})
              </button>
            )}
            <button
              onClick={() => startNewSession()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
            >
              <RotateCcw className="w-4 h-4" /> 再抽新一輪
            </button>
            <button
              onClick={handleBackToSetup}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
            >
              切換場合
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
