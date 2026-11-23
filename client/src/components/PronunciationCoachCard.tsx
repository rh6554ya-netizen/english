import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  Mic,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { aiApi, isAiApiConfigured } from '../lib/aiApi';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  blobToBase64,
  isAudioRecordingSupported,
  VoiceRecorder,
  type RecordedAudio,
} from '../lib/recorder';
import type { PronunciationAssessment, PronunciationWordFeedback } from '../../../shared/types';

interface Props {
  targetTextEn: string;
  targetTextZh: string;
  scenarioId?: string;
  scenarioTitle?: string;
  onPlayDemo?: () => void;
  onClose?: () => void;
  onScored?: (assessment: PronunciationAssessment) => void;
}

export function PronunciationCoachCard({
  targetTextEn,
  targetTextZh,
  scenarioId,
  scenarioTitle,
  onPlayDemo,
  onClose,
  onScored,
}: Props) {
  const { user, signInWithGoogle } = useAuth();
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [recorded, setRecorded] = useState<RecordedAudio | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState<PronunciationAssessment | null>(null);
  const [selectedWord, setSelectedWord] = useState<PronunciationWordFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);

  const recordingSupported = isAudioRecordingSupported();
  const aiConfigured = isAiApiConfigured();

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recorded?.objectUrl) URL.revokeObjectURL(recorded.objectUrl);
    };
  }, [recorded]);

  const startRecording = async () => {
    setError(null);
    setSelectedWord(null);
    try {
      const rec = new VoiceRecorder();
      await rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          if (s >= 29) {
            void stopRecording();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setError((err as Error).message || '無法啟動麥克風錄音');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec) return;

    try {
      const audio = await rec.stop();
      if (recorded?.objectUrl) URL.revokeObjectURL(recorded.objectUrl);
      setRecorded(audio);
      setResult(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAssess = async () => {
    if (!recorded) return;
    setError(null);
    setAssessing(true);
    setSelectedWord(null);
    try {
      const base64 = await blobToBase64(recorded.blob);
      const res = await aiApi.assessPronunciation({
        targetTextEn,
        audioBase64: base64,
        audioMimeType: recorded.mimeType,
        scenarioTitle,
      });
      setResult(res);
      setRemainingQuota(res.quota.remaining);
      onScored?.(res);

      await api.logPractice({
        activity_type: 'pronunciation_check',
        target_type: scenarioId ? 'scenario' : null,
        target_id: scenarioId || null,
        duration_seconds: Math.max(10, recorded.durationSec),
        score: res.overall_score,
        detail_json: {
          target_text_en: targetTextEn,
          heard_text: res.heard_text,
          accuracy_score: res.accuracy_score,
          fluency_score: res.fluency_score,
          intonation_score: res.intonation_score,
        },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssessing(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 85
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : score >= 70
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <div className="text-xs font-extrabold text-indigo-950">
              AI 發音、連音與語調評測教練
            </div>
            <div className="text-[11px] text-slate-500">
              先聽示範再跟讀錄音，由 Groq Whisper ＋ AI 教練極速診斷逐字清晰度與美式連音
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"
            aria-label="關閉評測面板"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {onPlayDemo && (
          <button
            onClick={onPlayDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 transition"
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> 先聽原音示範
          </button>
        )}

        {recordingSupported ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={assessing}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> 停止錄音（{recordSec}s）
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" /> {recorded ? '重新錄製跟讀' : '開始錄音跟讀'}
              </>
            )}
          </button>
        ) : (
          <span className="text-xs text-rose-600 font-semibold">此瀏覽器不支援麥克風錄音</span>
        )}

        {recorded && !isRecording && (
          <button
            onClick={handleAssess}
            disabled={assessing || !user || !aiConfigured}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold transition shadow-sm"
          >
            {assessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 聽音診斷中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> 送出 AI 發音評測
              </>
            )}
          </button>
        )}
      </div>

      {/* Recorded playback */}
      {recorded && (
        <div className="bg-white rounded-xl border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-600">
            🎙️ 你的跟讀錄音（{recorded.durationSec} 秒・{recorded.mimeType}）
          </span>
          <audio controls src={recorded.objectUrl} className="h-8 max-w-full" />
        </div>
      )}

      {/* Auth / Config prompt */}
      {!user && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <span>登入 Google 帳號後即可使用免費 AI 發音與連音評測（每日 30 次額度）。</span>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            <LogIn className="w-3.5 h-3.5" /> Google 登入
          </button>
        </div>
      )}

      {user && !aiConfigured && (
        <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-700">
          尚未設定 AI Proxy 網址（<code className="font-mono">VITE_AI_API_BASE</code>），請先於「AI 口說實戰」頁面設定或部署 Cloudflare Worker。
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Assessment Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-extrabold px-3 py-1 rounded-xl border ${scoreColor(
                  result.overall_score
                )}`}
              >
                {result.overall_score} 分
              </span>
              <div className="text-xs text-slate-600">
                <div className="font-bold text-slate-900">綜合發音評分</div>
                <div>{targetTextZh}</div>
              </div>
            </div>
            {remainingQuota !== null && (
              <span className="text-[11px] font-semibold text-slate-500">
                今日剩餘 AI 額度：{remainingQuota} 次
              </span>
            )}
          </div>

          {/* Sub-scores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '準確度', val: result.accuracy_score },
              { label: '流暢度', val: result.fluency_score },
              { label: '美式語調', val: result.intonation_score },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span>{item.label}</span>
                  <span className="font-extrabold text-slate-900">{item.val}</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.val >= 85
                        ? 'bg-emerald-500'
                        : item.val >= 70
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${item.val}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Word-by-word chips */}
          {result.word_feedback.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  逐字診斷（點擊黃／紅字查看微調建議）
                </span>
                <div className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="text-emerald-700">● 清晰</span>
                  <span className="text-amber-700">● 可更自然</span>
                  <span className="text-rose-700">● 漏唸/偏差</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.word_feedback.map((wf, idx) => {
                  const style =
                    wf.status === 'good'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : wf.status === 'watch'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 cursor-pointer hover:bg-amber-200'
                      : 'bg-rose-100 text-rose-900 border-rose-300 cursor-pointer hover:bg-rose-200';
                  return (
                    <button
                      key={`${wf.word}-${idx}`}
                      type="button"
                      onClick={() => {
                        if (wf.status !== 'good' || wf.tip_zh) setSelectedWord(wf);
                      }}
                      className={`px-2 py-1 rounded-lg border text-xs font-bold transition ${style}`}
                    >
                      {wf.word}
                    </button>
                  );
                })}
              </div>

              {selectedWord && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs space-y-1">
                  <div className="font-extrabold text-amber-950">
                    {selectedWord.word}{' '}
                    {selectedWord.ipa && (
                      <span className="font-mono text-amber-700 ml-1">{selectedWord.ipa}</span>
                    )}
                  </div>
                  <div className="text-amber-900">
                    {selectedWord.tip_zh || '注意重音位置與字尾子音收尾。'}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.heard_text && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
              <span className="font-bold text-slate-700">AI 實際聽到的內容：</span>
              <span className="italic">“{result.heard_text}”</span>
            </div>
          )}

          {/* Linking & Reduction tips */}
          {result.linking_tips_zh.length > 0 && (
            <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 space-y-1.5">
              <div className="text-xs font-extrabold text-indigo-900">🇺🇸 美式連音與節奏技巧</div>
              <ul className="space-y-1 text-xs text-indigo-950 list-disc pl-4">
                {result.linking_tips_zh.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{result.encouragement_zh}</span>
          </div>
        </div>
      )}
    </div>
  );
}
