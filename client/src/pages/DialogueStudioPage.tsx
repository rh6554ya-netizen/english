import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  Headphones,
  Info,
  Mic,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { api, type HydratedTurn, type ScenarioDetailResponse } from '../lib/api';
import { playAudio, sleep, stopAllAudio } from '../lib/audio';
import type { Vocabulary } from '../../../shared/types';

type Step = 1 | 2 | 3 | 4;
type SubtitleMode = 'bilingual' | 'en_only' | 'hide_zh';

function normalizeAnswer(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"’‘?。，！]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function DialogueStudioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<ScenarioDetailResponse | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);

  // Playback state
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [speed, setSpeed] = useState<0.75 | 1.0>(1.0);
  const stopFlagRef = useRef(false);

  // Step 2 study state
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('bilingual');
  const [selectedVocab, setSelectedVocab] = useState<Vocabulary | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Step 3 roleplay & recorder
  const [myRole, setMyRole] = useState<string>('');
  const [roleCountdown, setRoleCountdown] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Step 4 quiz
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .getScenarioDetail(slug)
      .then((res) => {
        setDetail(res);
        const firstTurns = res.dialogues[0]?.turns || [];
        const defaultLearner = firstTurns.find((t) => t.is_learner_role)?.speaker_role;
        setMyRole(defaultLearner || firstTurns[0]?.speaker_role || '');
      })
      .finally(() => setLoading(false));

    return () => {
      stopFlagRef.current = true;
      stopAllAudio();
    };
  }, [slug]);

  const stopPlayback = () => {
    stopFlagRef.current = true;
    stopAllAudio();
    setIsPlayingAll(false);
    setActiveTurnId(null);
    setRoleCountdown(null);
  };

  const dialogue = detail?.dialogues[0];
  const turns = dialogue?.turns || [];
  const roles = [...new Set(turns.map((t) => t.speaker_role))];

  const markProgress = async (
    patch: Parameters<typeof api.updateScenarioProgress>[1]
  ) => {
    if (!detail) return;
    const res = await api.updateScenarioProgress(detail.scenario.id, patch);
    setDetail((prev) => (prev ? { ...prev, progress: res.progress } : prev));
  };

  const playSequence = async (roleplayMode: boolean) => {
    if (isPlayingAll) {
      stopPlayback();
      return;
    }
    stopFlagRef.current = false;
    setIsPlayingAll(true);

    for (const turn of turns) {
      if (stopFlagRef.current) break;
      setActiveTurnId(turn.id);

      if (roleplayMode && turn.speaker_role === myRole) {
        // Silent turn for learner to speak aloud
        for (let sec = 4; sec >= 1; sec--) {
          if (stopFlagRef.current) break;
          setRoleCountdown(sec);
          await sleep(1000);
        }
        setRoleCountdown(null);
      } else {
        const url = speed === 0.75 ? turn.audio_slow_url : turn.audio_normal_url;
        await playAudio({
          url,
          fallbackText: turn.text_en,
          rate: url ? 1.0 : speed,
        });
        if (!stopFlagRef.current) await sleep(500);
      }
    }

    const finishedCleanly = !stopFlagRef.current;
    setIsPlayingAll(false);
    setActiveTurnId(null);
    setRoleCountdown(null);

    if (finishedCleanly) {
      if (!roleplayMode && step === 1) {
        await markProgress({ step1_blind_listen_done: true, duration_seconds: 60 });
        showToast('已完成 Step 1 純聽訓練！');
      } else if (roleplayMode) {
        await markProgress({ step3_shadowing_done: true, duration_seconds: 90 });
        showToast('已完成 Step 3 角色扮演跟讀！');
      }
    }
  };

  const playSingleTurn = async (turn: HydratedTurn, mode: 'normal' | 'slow' | 'zh') => {
    stopPlayback();
    setActiveTurnId(turn.id);
    const url =
      mode === 'slow'
        ? turn.audio_slow_url
        : mode === 'zh'
        ? turn.audio_zh_url
        : turn.audio_normal_url;
    await playAudio({
      url,
      fallbackText: mode === 'zh' ? turn.text_zh : turn.text_en,
      lang: mode === 'zh' ? 'zh-TW' : 'en-US',
      rate: !url && mode === 'slow' ? 0.75 : 1.0,
    });
    setActiveTurnId(null);
  };

  const handleBookmarkVocab = async (v: Vocabulary) => {
    const res = await api.addSrsCard({
      item_type: 'vocabulary',
      item_id: v.id,
      front_zh: `${v.meaning_zh}${v.equivalent_word ? `（對照：${v.equivalent_word}）` : ''}`,
      back_en: v.word_en,
      ipa: v.ipa_us,
      audio_url: v.audio_url,
      personal_note: v.example_en || null,
    });
    showToast(res.already_exists ? '此單字已在 SRS 複習庫中' : `已加入 SRS：「${v.word_en}」`);
  };

  const handleBookmarkTurn = async (t: HydratedTurn) => {
    const res = await api.addSrsCard({
      item_type: 'dialogue_turn',
      item_id: t.id,
      front_zh: t.text_zh,
      back_en: t.text_en,
      audio_url: t.audio_normal_url,
      personal_note: `${detail?.scenario.title_zh || ''}（${t.speaker_role}）`,
    });
    showToast(res.already_exists ? '此句子已在 SRS 複習庫中' : '已收藏此句至 SRS 複習庫！');
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setIsRecording(true);
    } catch {
      showToast('無法存取麥克風，請確認瀏覽器權限');
    }
  };

  const handleSubmitQuiz = async () => {
    if (!detail) return;
    const exs = detail.exercises;
    if (!exs.length) return;
    let correct = 0;
    for (const ex of exs) {
      const userAns = normalizeAnswer(answers[ex.id] || '');
      const accepted = [ex.correct_answer, ...(ex.acceptable_answers_json || [])].map(
        normalizeAnswer
      );
      if (userAns && accepted.includes(userAns)) correct++;
    }
    const score = Math.round((correct / exs.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    await markProgress({ step4_quiz_best_score: score, duration_seconds: 90 });
    showToast(`測驗完成！得分 ${score} 分`);
  };

  const renderHighlightedText = (turn: HydratedTurn) => {
    if (!turn.highlights.length) return turn.text_en;
    const escaped = turn.highlights.map((h) =>
      h.highlight_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = turn.text_en.split(regex);
    return parts.map((part, idx) => {
      const match = turn.highlights.find(
        (h) => h.highlight_text.toLowerCase() === part.toLowerCase()
      );
      if (!match) return <span key={idx}>{part}</span>;
      return (
        <button
          key={idx}
          onClick={() => setSelectedVocab(match.vocabulary)}
          className="inline px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold underline decoration-amber-400 decoration-2 underline-offset-2 transition"
        >
          {part}
        </button>
      );
    });
  };

  if (loading || !detail || !dialogue) {
    return <div className="p-12 text-center text-slate-500">載入學習室中...</div>;
  }

  const prog = detail.progress;
  const stepsMeta: { id: Step; title: string; subtitle: string; done: boolean }[] = [
    { id: 1, title: 'Step 1 純聽情境', subtitle: 'Blind Listen', done: Boolean(prog?.step1_blind_listen_done) },
    { id: 2, title: 'Step 2 字幕精讀', subtitle: 'Bilingual Study', done: Boolean(prog?.step2_study_done) },
    { id: 3, title: 'Step 3 角色扮演', subtitle: 'Role-play & Shadow', done: Boolean(prog?.step3_shadowing_done) },
    { id: 4, title: 'Step 4 反向測驗', subtitle: 'Revision Quiz', done: (prog?.step4_quiz_best_score ?? 0) >= 60 },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            to="/scenarios"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 返回情境課程館
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">{detail.scenario.title_zh}</h1>
          <p className="text-sm text-indigo-600 font-semibold mt-0.5">
            {detail.scenario.title_en}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">
            來源：{dialogue.source_ref || dialogue.source?.title}
          </div>
          <div className="text-sm font-bold text-indigo-600 mt-1">
            進度：{prog?.completion_percent ?? 0}%
          </div>
        </div>
      </div>

      {/* 4-Step Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stepsMeta.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              stopPlayback();
              setStep(s.id);
            }}
            className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between gap-2 ${
              step === s.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200/70'
                : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800'
            }`}
          >
            <div>
              <div className="font-bold text-sm">{s.title}</div>
              <div
                className={`text-[11px] mt-0.5 ${
                  step === s.id ? 'text-indigo-100' : 'text-slate-400'
                }`}
              >
                {s.subtitle}
              </div>
            </div>
            {s.done && (
              <CheckCircle2
                className={`w-5 h-5 shrink-0 ${
                  step === s.id ? 'text-emerald-300' : 'text-emerald-500'
                }`}
              />
            )}
          </button>
        ))}
      </div>

      {/* STEP 1: BLIND LISTEN */}
      {step === 1 && (
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Headphones className="w-8 h-8" />
          </div>
          <div className="max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Step 1 · Blind Listen
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              先不看字幕，專注聽懂情境脈絡
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {detail.scenario.story_background}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-semibold text-slate-500">播放語速：</span>
            {([0.75, 1.0] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSpeed(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  speed === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 0.75 ? '0.75x 慢速' : '1.0x 常速'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => playSequence(false)}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition"
            >
              {isPlayingAll ? (
                <>
                  <Square className="w-4 h-4 fill-current" /> 停止播放
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> 開始純聽完整對話（{turns.length} 輪）
                </>
              )}
            </button>
            <button
              onClick={async () => {
                await markProgress({ step1_blind_listen_done: true, duration_seconds: 30 });
                setStep(2);
              }}
              className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 text-sm font-semibold text-slate-700 transition"
            >
              完成純聽，進入 Step 2 精讀 ➜
            </button>
          </div>

          {/* Blind visual progress dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {turns.map((t, i) => (
              <div
                key={t.id}
                className={`h-2.5 rounded-full transition-all ${
                  activeTurnId === t.id
                    ? 'w-10 bg-indigo-600 animate-pulse'
                    : 'w-2.5 bg-slate-200'
                }`}
                title={`第 ${i + 1} 輪 (${t.speaker_role})`}
              />
            ))}
          </div>
        </section>
      )}

      {/* STEP 2: BILINGUAL STUDY */}
      {step === 2 && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'bilingual', label: '中英雙語' },
                    { id: 'en_only', label: '純英文' },
                    { id: 'hide_zh', label: '點擊顯示中文' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSubtitleMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      subtitleMode === m.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-semibold">
                💡 點擊黃色高亮字詞查看 IPA 音標與英美差異
              </span>
            </div>

            <div className="space-y-3">
              {turns.map((turn) => {
                const isRight = turn.speaker_side === 'right';
                const isActive = activeTurnId === turn.id;
                return (
                  <div
                    key={turn.id}
                    className={`rounded-2xl border p-4 transition ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-200'
                        : isRight
                        ? 'bg-indigo-50/30 border-indigo-100'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isRight
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {turn.speaker_role}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => playSingleTurn(turn, 'normal')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> 常速
                        </button>
                        <button
                          onClick={() => playSingleTurn(turn, 'slow')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs font-semibold text-slate-700"
                        >
                          0.75x
                        </button>
                        <button
                          onClick={() => playSingleTurn(turn, 'zh')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 text-xs font-semibold text-emerald-700"
                        >
                          中文
                        </button>
                        <button
                          onClick={() => handleBookmarkTurn(turn)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-amber-400 text-amber-600"
                          title="收藏至 SRS 複習庫"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-base font-semibold text-slate-900 leading-relaxed">
                      {renderHighlightedText(turn)}
                    </div>

                    {turn.text_en_alt_locale && (
                      <div className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1 mt-2 inline-block">
                        🇬🇧 / 🇺🇸 等價說法：{turn.text_en_alt_locale}
                      </div>
                    )}

                    {subtitleMode === 'bilingual' && (
                      <div className="text-sm text-slate-600 mt-1.5">{turn.text_zh}</div>
                    )}
                    {subtitleMode === 'hide_zh' && (
                      <details className="mt-1.5">
                        <summary className="text-xs text-indigo-600 cursor-pointer font-semibold select-none">
                          查看中文翻譯
                        </summary>
                        <div className="text-sm text-slate-600 mt-1">{turn.text_zh}</div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={async () => {
                  await markProgress({ step2_study_done: true, duration_seconds: 120 });
                  showToast('已完成 Step 2 精讀！');
                  setStep(3);
                }}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition"
              >
                標記精讀完成，進入 Step 3 角色扮演 ➜
              </button>
            </div>
          </div>

          {/* Right Rail: Cultural Notes & Vocab Drawer */}
          <aside className="space-y-4">
            {selectedVocab && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {selectedVocab.word_en}
                    </div>
                    <div className="text-xs text-amber-800 font-mono mt-0.5">
                      {selectedVocab.part_of_speech} {selectedVocab.ipa_us}
                      {selectedVocab.ipa_uk ? ` | UK ${selectedVocab.ipa_uk}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedVocab(null)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  {selectedVocab.meaning_zh}
                </div>
                {selectedVocab.equivalent_word && (
                  <div className="text-xs bg-white/80 rounded-lg px-3 py-1.5 border border-amber-200 text-slate-700">
                    英美對照：<strong>{selectedVocab.equivalent_word}</strong>
                  </div>
                )}
                {selectedVocab.example_en && (
                  <div className="text-xs text-slate-600 bg-white/70 rounded-lg p-2.5">
                    <div className="font-semibold text-slate-800">{selectedVocab.example_en}</div>
                    <div className="mt-0.5">{selectedVocab.example_zh}</div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      playAudio({
                        url: selectedVocab.audio_url,
                        fallbackText: selectedVocab.word_en,
                      })
                    }
                    className="flex-1 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100 inline-flex items-center justify-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> 發音
                  </button>
                  <button
                    onClick={() => handleBookmarkVocab(selectedVocab)}
                    className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> 加入 SRS
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
                <Info className="w-4 h-4 text-indigo-600" />
                文化與實戰小提示
              </div>
              {detail.cultural_notes.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-bold text-xs text-indigo-700">{n.title_zh}</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.content_zh}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* STEP 3: ROLE-PLAY & SHADOWING */}
      {step === 3 && (
        <section className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600">選擇你要扮演的角色：</span>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setMyRole(r)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                    myRole === r
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => setSpeed((s) => (s === 1.0 ? 0.75 : 1.0))}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
              >
                語速：{speed === 0.75 ? '0.75x 慢速' : '1.0x 常速'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => playSequence(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm"
              >
                {isPlayingAll ? (
                  <>
                    <Square className="w-4 h-4 fill-current" /> 停止演練
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> 開始角色扮演
                  </>
                )}
              </button>
              <button
                onClick={toggleRecording}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                  isRecording
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                }`}
              >
                <Mic className="w-4 h-4" />
                {isRecording ? '停止錄音' : '錄音自我比對'}
              </button>
            </div>
          </div>

          {recordedUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-emerald-800">🎙️ 你的跟讀錄音已就緒，可播放比對語調：</span>
              <audio controls src={recordedUrl} className="h-9" />
            </div>
          )}

          <div className="space-y-3">
            {turns.map((turn) => {
              const isMine = turn.speaker_role === myRole;
              const isActive = activeTurnId === turn.id;
              return (
                <div
                  key={turn.id}
                  className={`rounded-2xl border p-4 transition ${
                    isActive && isMine
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                      : isActive
                      ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200'
                      : isMine
                      ? 'border-indigo-200 bg-white'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isMine ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-800'
                        }`}
                      >
                        {isMine ? `🗣️ 你扮演：${turn.speaker_role}` : `👂 系統：${turn.speaker_role}`}
                      </span>
                      {isActive && isMine && roleCountdown !== null && (
                        <span className="text-xs font-extrabold text-amber-700 animate-pulse">
                          輪到你開口！倒數 {roleCountdown} 秒...
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => playSingleTurn(turn, speed === 0.75 ? 'slow' : 'normal')}
                      className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> 聽示範
                    </button>
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-2">{turn.text_en}</div>
                  <div className="text-xs text-slate-500 mt-1">{turn.text_zh}</div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={async () => {
                await markProgress({ step3_shadowing_done: true, duration_seconds: 90 });
                setStep(4);
              }}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm"
            >
              完成跟讀，挑戰 Step 4 課後測驗 ➜
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: REVISION QUIZ */}
      {step === 4 && (
        <section className="space-y-5">
          {detail.exercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              此情境尚無測驗題。
            </div>
          ) : (
            <>
              {quizSubmitted && quizScore !== null && (
                <div className="bg-indigo-600 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-indigo-200 font-bold">
                      Revision Result
                    </div>
                    <div className="text-2xl font-extrabold mt-1">
                      本次測驗得分：{quizScore} 分 {quizScore >= 80 ? '🎉 太棒了！' : '💪 再多聽兩遍！'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAnswers({});
                      setQuizSubmitted(false);
                      setQuizScore(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-indigo-700 text-sm font-bold"
                  >
                    重新作答
                  </button>
                </div>
              )}

              {detail.exercises.map((ex, idx) => {
                const userAns = answers[ex.id] || '';
                const accepted = [ex.correct_answer, ...(ex.acceptable_answers_json || [])].map(
                  normalizeAnswer
                );
                const isCorrect =
                  quizSubmitted && accepted.includes(normalizeAnswer(userAns));

                return (
                  <div
                    key={ex.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        第 {idx + 1} 題 ·{' '}
                        {ex.exercise_type === 'reverse_translation'
                          ? '反向中翻英'
                          : ex.exercise_type === 'listening_choice'
                          ? '聽力理解選擇'
                          : '情境填空'}
                      </span>
                      {ex.prompt_audio_url && (
                        <button
                          onClick={() =>
                            playAudio({
                              url: ex.prompt_audio_url,
                              fallbackText: ex.correct_answer,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> 播放提示音檔
                        </button>
                      )}
                    </div>

                    <div className="font-bold text-slate-900 whitespace-pre-line">
                      {ex.prompt_text}
                    </div>

                    {ex.options_json && ex.options_json.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {ex.options_json.map((opt) => (
                          <button
                            key={opt}
                            disabled={quizSubmitted}
                            onClick={() => setAnswers((prev) => ({ ...prev, [ex.id]: opt }))}
                            className={`text-left px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                              userAns === opt
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        disabled={quizSubmitted}
                        value={userAns}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [ex.id]: e.target.value }))
                        }
                        placeholder="請輸入完整英文句子..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}

                    {quizSubmitted && (
                      <div
                        className={`p-3.5 rounded-xl text-xs space-y-1 ${
                          isCorrect
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border border-rose-200 text-rose-900'
                        }`}
                      >
                        <div className="font-bold">
                          {isCorrect ? '✅ 答對了！' : `❌ 正確答案：${ex.correct_answer}`}
                        </div>
                        {ex.explanation_zh && <div>解析：{ex.explanation_zh}</div>}
                      </div>
                    )}
                  </div>
                );
              })}

              {!quizSubmitted && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitQuiz}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                  >
                    送出批改並儲存成績
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
