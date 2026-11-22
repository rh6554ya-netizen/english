import { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Plus, Trash2, Volume2 } from 'lucide-react';
import { api } from '../lib/api';
import { playAudio } from '../lib/audio';
import type { UserSrsCard } from '../../../shared/types';

export function SrsVaultPage() {
  const [cards, setCards] = useState<UserSrsCard[]>([]);
  const [mode, setMode] = useState<'review' | 'manage'>('review');
  const [flipped, setFlipped] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newNote, setNewNote] = useState('');

  const load = async () => {
    const res = await api.getSrsCards();
    setCards(res.cards);
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const dueCards = cards.filter((c) => new Date(c.next_review_at) <= now);
  const currentCard = dueCards[0];

  const handleReview = async (quality: number) => {
    if (!currentCard) return;
    await api.reviewSrsCard(currentCard.id, quality);
    setFlipped(false);
    await load();
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    await api.addSrsCard({
      item_type: 'vocabulary',
      item_id: `custom-${Date.now()}`,
      front_zh: newFront.trim(),
      back_en: newBack.trim(),
      personal_note: newNote.trim() || null,
    });
    setNewFront('');
    setNewBack('');
    setNewNote('');
    setAdding(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteSrsCard(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">個人 SRS 間隔重複複習庫</h1>
          <p className="text-sm text-slate-500 mt-1">
            採用 SM-2 演算法動態安排最佳複習間隔，統一管理生詞、句型、道地表達與卡關題
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('review')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              mode === 'review'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            今日翻卡複習 ({dueCards.length})
          </button>
          <button
            onClick={() => setMode('manage')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              mode === 'manage'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            全部卡片 ({cards.length})
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            title="手動新增卡片"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={handleAddCard}
          className="bg-white rounded-2xl border border-indigo-200 p-5 grid sm:grid-cols-3 gap-3 shadow-sm"
        >
          <input
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            placeholder="正面中文提示（例：我恐怕去不了）"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            required
          />
          <input
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder="背面英文答案（例：I'm afraid I can't make it.）"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            required
          />
          <div className="flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="個人記憶筆記（選填）"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold"
            >
              新增
            </button>
          </div>
        </form>
      )}

      {mode === 'review' && (
        <div className="max-w-2xl mx-auto">
          {!currentCard ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-extrabold text-slate-900">今日到期卡片已全部複習完畢！</h2>
              <p className="text-sm text-slate-500">
                可前往「情境課程館」或「3 秒反應訓練」收藏更多道地句子。
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-6 text-center">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold">
                  {currentCard.item_type}
                </span>
                <span>
                  剩餘 {dueCards.length} 張 · 係數 EF {currentCard.ease_factor}
                </span>
              </div>

              <div className="py-6 space-y-3">
                <div className="text-xs font-bold text-indigo-600 uppercase">看中文想英文</div>
                <div className="text-2xl font-extrabold text-slate-900 leading-snug">
                  {currentCard.front_zh}
                </div>
              </div>

              {!flipped ? (
                <button
                  onClick={() => {
                    setFlipped(true);
                    playAudio({
                      url: currentCard.audio_url,
                      fallbackText: currentCard.back_en,
                    });
                  }}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md transition"
                >
                  翻開答案並播放發音
                </button>
              ) : (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <div className="text-2xl font-extrabold text-indigo-700">
                      {currentCard.back_en}
                    </div>
                    {currentCard.ipa && (
                      <div className="text-sm font-mono text-slate-500">{currentCard.ipa}</div>
                    )}
                    {currentCard.personal_note && (
                      <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 inline-block">
                        📝 {currentCard.personal_note}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() =>
                          playAudio({
                            url: currentCard.audio_url,
                            fallbackText: currentCard.back_en,
                          })
                        }
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        <Volume2 className="w-4 h-4" /> 再聽一次
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    <button
                      onClick={() => handleReview(0)}
                      className="py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold"
                    >
                      重來
                      <div className="text-[10px] font-medium mt-0.5">明天複習</div>
                    </button>
                    <button
                      onClick={() => handleReview(3)}
                      className="py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-extrabold"
                    >
                      困難
                      <div className="text-[10px] font-medium mt-0.5">縮短間隔</div>
                    </button>
                    <button
                      onClick={() => handleReview(4)}
                      className="py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold"
                    >
                      良好
                      <div className="text-[10px] font-medium mt-0.5">標準 SM-2</div>
                    </button>
                    <button
                      onClick={() => handleReview(5)}
                      className="py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-extrabold"
                    >
                      秒懂
                      <div className="text-[10px] font-medium mt-0.5">拉長間隔</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'manage' && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {cards.map((c) => {
            const isDue = new Date(c.next_review_at) <= now;
            return (
              <div
                key={c.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-extrabold text-slate-900 text-sm">{c.back_en}</span>
                    {c.ipa && <span className="text-xs font-mono text-slate-400">{c.ipa}</span>}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDue
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isDue ? '今日到期' : `${c.interval_days} 天後複習`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{c.front_zh}</div>
                  {c.personal_note && (
                    <div className="text-[11px] text-slate-400">📝 {c.personal_note}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => playAudio({ url: c.audio_url, fallbackText: c.back_en })}
                    className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 text-indigo-600"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 rounded-lg border border-slate-200 hover:border-rose-400 text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
