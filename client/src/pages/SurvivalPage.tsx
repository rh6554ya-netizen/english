import { useEffect, useState } from 'react';
import { Maximize2, ShieldAlert, Volume2, X } from 'lucide-react';
import { api, type SurvivalPhrase } from '../lib/api';
import { playAudio } from '../lib/audio';

export function SurvivalPage() {
  const [phrases, setPhrases] = useState<SurvivalPhrase[]>([]);
  const [filter, setFilter] = useState<'all' | 'emergency' | 'travel' | 'shopping'>('all');
  const [fullscreenCard, setFullscreenCard] = useState<SurvivalPhrase | null>(null);

  useEffect(() => {
    api.getSurvival().then((r) => setPhrases(r.phrases));
  }, []);

  const visible =
    filter === 'all' ? phrases : phrases.filter((p) => p.category === filter);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-600 to-orange-600 text-white rounded-3xl p-6 sm:p-7 shadow-md">
        <div className="inline-flex items-center gap-2 text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
          <ShieldAlert className="w-3.5 h-3.5" />
          Pocket Survival Phrasebook
        </div>
        <h1 className="text-2xl font-extrabold mt-2">出國與緊急隨身急救卡</h1>
        <p className="text-sm text-rose-100 mt-1">
          高壓情境直接照唸、點播語音或「全螢幕大字出示」給海關、店員、醫師或警方看
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: '全部急救句' },
            { id: 'emergency', label: '🚨 緊急自保（護照 / 就醫 / 報警）' },
            { id: 'travel', label: '✈️ 海關 / 食物過敏 / 問路' },
            { id: 'shopping', label: '🛍️ 試穿 / 折扣 / 刷卡退換' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              filter === tab.id
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-rose-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {visible.map((p) => (
          <div
            key={p.id}
            className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 shadow-sm ${
              p.category === 'emergency' ? 'border-rose-200' : 'border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                    p.category === 'emergency'
                      ? 'bg-rose-100 text-rose-700'
                      : p.category === 'shopping'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {p.tag}
                </span>
                <button
                  onClick={() => setFullscreenCard(p)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                  title="大字體全螢幕出示"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> 放大出示
                </button>
              </div>

              <div className="text-lg font-extrabold text-slate-900 mt-3 leading-snug">
                {p.en}
              </div>
              <div className="text-sm font-semibold text-slate-600 mt-1.5">{p.zh}</div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">💡 {p.tip_zh}</p>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => playAudio({ url: p.audio_normal_url, fallbackText: p.en })}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
              >
                <Volume2 className="w-4 h-4" /> 一鍵常速播放
              </button>
              <button
                onClick={() =>
                  playAudio({ url: p.audio_slow_url, fallbackText: p.en, rate: 0.75 })
                }
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
              >
                🐢 0.75x 慢速
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Show-to-Staff Modal */}
      {fullscreenCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 text-white flex flex-col items-center justify-center p-6 text-center">
          <button
            onClick={() => setFullscreenCard(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>
          <span className="text-sm font-bold px-4 py-1.5 rounded-full bg-rose-600">
            {fullscreenCard.tag}
          </span>
          <div className="text-3xl sm:text-5xl font-extrabold leading-tight max-w-4xl mt-6">
            {fullscreenCard.en}
          </div>
          <div className="text-lg sm:text-2xl text-slate-300 mt-5">{fullscreenCard.zh}</div>
          <button
            onClick={() =>
              playAudio({ url: fullscreenCard.audio_normal_url, fallbackText: fullscreenCard.en })
            }
            className="mt-8 px-8 py-4 rounded-2xl bg-white text-slate-900 font-extrabold text-base inline-flex items-center gap-2 shadow-xl"
          >
            <Volume2 className="w-5 h-5" /> 播放語音給對方聽
          </button>
        </div>
      )}
    </div>
  );
}
