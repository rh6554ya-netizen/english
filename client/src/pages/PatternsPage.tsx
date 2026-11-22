import { useEffect, useState } from 'react';
import { ArrowRight, BookmarkPlus, Sparkles, Volume2 } from 'lucide-react';
import { api } from '../lib/api';
import { playAudio } from '../lib/audio';
import type { Expression, ExpressionGroup, SentencePattern } from '../../../shared/types';

type Tab = 'slots' | 'upgrade' | 'spectrum';

const REGISTER_STYLE: Record<string, { label: string; cls: string }> = {
  formal: { label: 'Formal 正式', cls: 'bg-indigo-100 text-indigo-800' },
  neutral: { label: 'Neutral 通用', cls: 'bg-emerald-100 text-emerald-800' },
  informal: { label: 'Informal 口語', cls: 'bg-amber-100 text-amber-800' },
  slang: { label: 'Slang 俚語', cls: 'bg-rose-100 text-rose-800' },
};

const NUANCE_LABEL: Record<string, string> = {
  hedging: 'Hedging 禮貌緩衝',
  softening: 'Softening 軟化語氣',
  small_talk_bridge: 'Small Talk 延伸接話',
  idiom: '地道慣用語',
  filler: '自然語氣詞',
};

export function PatternsPage() {
  const [tab, setTab] = useState<Tab>('slots');
  const [patterns, setPatterns] = useState<(SentencePattern & { scenario_title_zh: string })[]>([]);
  const [groups, setGroups] = useState<(ExpressionGroup & { expressions: Expression[] })[]>([]);
  const [slotSelections, setSlotSelections] = useState<Record<string, Record<string, number>>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.getPatterns().then((r) => setPatterns(r.patterns));
    api.getExpressions().then((r) => setGroups(r.groups));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const renderPatternSentence = (p: SentencePattern) => {
    let en = p.formula_en;
    let zh = p.formula_zh;
    let isDefault = true;
    for (const slot of p.slots_json) {
      const idx = slotSelections[p.id]?.[slot.key] ?? 0;
      if (idx !== 0) isDefault = false;
      const choice = slot.choices[idx] || slot.choices[0];
      if (choice) {
        en = en.replace(`{{${slot.key}}}`, choice.en);
        zh = zh.replace(`{{${slot.key}}}`, choice.zh);
      }
    }
    return { en, zh, isDefault };
  };

  const handleSaveExpression = async (e: Expression) => {
    const res = await api.addSrsCard({
      item_type: 'expression',
      item_id: e.id,
      front_zh: e.meaning_zh,
      back_en: e.native_en,
      audio_url: e.audio_normal_url,
      personal_note: e.idiom_note || (e.standard_en ? `取代直譯：${e.standard_en}` : null),
    });
    showToast(res.already_exists ? '此表達已在 SRS 複習庫中' : '已加入 SRS 複習庫！');
  };

  const handleSavePattern = async (p: SentencePattern, en: string, zh: string) => {
    const res = await api.addSrsCard({
      item_type: 'sentence_pattern',
      item_id: p.id,
      front_zh: zh,
      back_en: en,
      audio_url: p.audio_normal_url,
      personal_note: p.pragmatic_note,
    });
    showToast(res.already_exists ? '此句型已在 SRS 複習庫中' : '已加入 SRS 複習庫！');
  };

  const upgradeGroups = groups.filter((g) => g.group_type === 'native_upgrade');
  const spectrumGroups = groups.filter((g) => g.group_type === 'synonym_spectrum');

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">萬用句型工坊 & 道地美式口語升級</h1>
        <p className="text-sm text-slate-500 mt-1">
          即時替換詞槽朗讀完整句、擺脫教科書直譯腔，並掌握正式到俚語的語氣光譜
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'slots', label: `🧩 可替換詞槽工坊 (${patterns.length})` },
            { id: 'upgrade', label: '✨ 教科書 ➜ 道地美式對照' },
            { id: 'spectrum', label: '🎚️ 同義表達與語域光譜' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SLOT SUBSTITUTION */}
      {tab === 'slots' && (
        <div className="grid md:grid-cols-2 gap-5">
          {patterns.map((p) => {
            const { en, zh, isDefault } = renderPatternSentence(p);
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {p.speaker_role} · {p.scenario_title_zh}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        playAudio({
                          url: isDefault ? p.audio_normal_url : null,
                          fallbackText: en,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> 朗讀
                    </button>
                    <button
                      onClick={() => handleSavePattern(p, en, zh)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400 text-amber-600"
                      title="加入 SRS"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-lg font-extrabold text-slate-900 leading-snug">{en}</div>
                  <div className="text-sm text-slate-600 mt-1">{zh}</div>
                </div>

                <div className="space-y-3">
                  {p.slots_json.map((slot) => {
                    const selectedIdx = slotSelections[p.id]?.[slot.key] ?? 0;
                    return (
                      <div key={slot.key}>
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                          點選替換「{slot.label_zh}」
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {slot.choices.map((c, idx) => (
                            <button
                              key={c.en}
                              onClick={() => {
                                setSlotSelections((prev) => ({
                                  ...prev,
                                  [p.id]: { ...(prev[p.id] || {}), [slot.key]: idx },
                                }));
                                const nextEn = p.formula_en.replace(`{{${slot.key}}}`, c.en);
                                playAudio({ fallbackText: nextEn });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                selectedIdx === idx
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              {c.en} <span className="opacity-75">({c.zh})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {p.pragmatic_note && (
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                    💡 {p.pragmatic_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TEXTBOOK VS NATIVE UPGRADE */}
      {tab === 'upgrade' && (
        <div className="space-y-6">
          {upgradeGroups.map((g) => (
            <section
              key={g.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                  <Sparkles className="w-3.5 h-3.5" /> {g.topic_code}
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">{g.title_zh}</h2>
                <div className="text-xs text-slate-400">{g.title_en}</div>
              </div>

              <div className="space-y-3">
                {g.expressions.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-2xl border border-slate-200/80 p-4 grid md:grid-cols-12 gap-4 items-center"
                  >
                    <div className="md:col-span-4 bg-slate-50 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-slate-400">教科書直譯</div>
                      <div className="text-sm font-semibold text-slate-600 line-through decoration-rose-400 mt-1">
                        {e.standard_en}
                      </div>
                    </div>

                    <div className="hidden md:flex md:col-span-1 justify-center text-indigo-500">
                      <ArrowRight className="w-5 h-5" />
                    </div>

                    <div className="md:col-span-7 bg-emerald-50/70 border border-emerald-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {e.nuance_type && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              {NUANCE_LABEL[e.nuance_type] || e.nuance_type}
                            </span>
                          )}
                          <div className="text-base font-extrabold text-slate-900 mt-1.5">
                            {e.native_en}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">{e.meaning_zh}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              playAudio({ url: e.audio_normal_url, fallbackText: e.native_en })
                            }
                            className="p-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white transition"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSaveExpression(e)}
                            className="p-2 rounded-lg bg-white border border-emerald-200 text-amber-600 hover:bg-amber-50"
                          >
                            <BookmarkPlus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {e.idiom_note && (
                        <p className="text-xs text-emerald-900/80 leading-relaxed">
                          💡 {e.idiom_note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* TAB 3: REGISTER SPECTRUM */}
      {tab === 'spectrum' && (
        <div className="space-y-6">
          {spectrumGroups.map((g) => (
            <section
              key={g.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
            >
              <div>
                <span className="text-xs font-bold text-slate-400">{g.topic_code}</span>
                <h2 className="text-lg font-extrabold text-slate-900">{g.title_zh}</h2>
                <div className="text-xs text-slate-500">{g.title_en}</div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {g.expressions.map((e) => {
                  const badge = REGISTER_STYLE[e.register_tag] || REGISTER_STYLE.neutral;
                  return (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3 bg-slate-50/50"
                    >
                      <div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <div className="font-extrabold text-slate-900 text-sm mt-3 leading-snug">
                          {e.native_en}
                        </div>
                        <div className="text-xs text-slate-600 mt-1.5">{e.meaning_zh}</div>
                        {e.idiom_note && (
                          <div className="text-[11px] text-slate-400 mt-2">{e.idiom_note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                        <button
                          onClick={() =>
                            playAudio({ url: e.audio_normal_url, fallbackText: e.native_en })
                          }
                          className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs font-bold text-indigo-600 inline-flex items-center justify-center gap-1"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> 播放
                        </button>
                        <button
                          onClick={() => handleSaveExpression(e)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-amber-400 text-amber-600"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
