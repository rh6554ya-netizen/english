import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  Plane,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import {
  cacheAudioPaths,
  clearAudioCache,
  countCachedPaths,
  getAllAudioPaths,
  getCachedAudioUrlSet,
  getOfflinePacks,
  getStorageEstimateMb,
  isCacheApiSupported,
  type DownloadProgress,
  type OfflinePackDefinition,
} from '../lib/offlineCache';
import { usePwa } from '../lib/pwa';

interface OfflinePackPanelProps {
  onCacheUpdated?: (cachedSet: Set<string>) => void;
}

export function OfflinePackPanel({ onCacheUpdated }: OfflinePackPanelProps) {
  const { isOnline } = usePwa();
  const packs = useMemo(() => getOfflinePacks(), []);
  const allAudioTotal = useMemo(() => getAllAudioPaths().length, []);

  const [cachedSet, setCachedSet] = useState<Set<string>>(new Set());
  const [storageMb, setStorageMb] = useState<{ usedMb: number; quotaMb: number } | null>(null);
  const [activePackId, setActivePackId] = useState<OfflinePackDefinition['id'] | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const supported = isCacheApiSupported();

  const refreshStats = useCallback(async () => {
    const [set, est] = await Promise.all([getCachedAudioUrlSet(), getStorageEstimateMb()]);
    setCachedSet(set);
    setStorageMb(est);
    onCacheUpdated?.(set);
  }, [onCacheUpdated]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleDownloadPack = async (pack: OfflinePackDefinition) => {
    if (!isOnline) {
      setStatusMessage('目前處於離線狀態，請連線後再下載新的語音包。');
      return;
    }
    if (activePackId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setActivePackId(pack.id);
    setStatusMessage(null);
    setProgress({ completed: 0, total: pack.urls.length, failed: 0, skipped: 0 });

    const res = await cacheAudioPaths(
      pack.urls,
      (p) => setProgress(p),
      controller.signal
    );

    abortRef.current = null;
    setActivePackId(null);
    setProgress(null);
    await refreshStats();

    if (controller.signal.aborted) {
      setStatusMessage(`已暫停下載「${pack.title}」（已保留先前完成的 ${res.completed} 支音檔）。`);
    } else if (res.failed > 0) {
      setStatusMessage(
        `「${pack.title}」已快取 ${res.completed}/${res.total} 支（${res.failed} 支失敗，可稍後重試）。`
      );
    } else {
      setStatusMessage(`✅「${pack.title}」全部 ${res.total} 支 MP3 已離線快取完成！`);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleClearOptional = async () => {
    setClearing(true);
    setStatusMessage(null);
    try {
      await clearAudioCache(true);
      await refreshStats();
      setStatusMessage('已清除選配課程音檔，並保留 22 支隨身急救卡語音。');
    } finally {
      setClearing(false);
    }
  };

  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
        目前瀏覽器不支援 Cache Storage API（可能處於無痕模式），無法建立離線語音快取。
      </div>
    );
  }

  const totalCachedCount = countCachedPaths(getAllAudioPaths(), cachedSet);
  const optionalCachedCount = Math.max(
    0,
    totalCachedCount - countCachedPaths(packs[0].urls, cachedSet)
  );

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
            <Plane className="w-3.5 h-3.5" /> 出國離線語音快取中心
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
            預先下載 MP3，飛航模式也能練聽力與播放急救卡
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            每次聽過的音檔也會自動快取在本機；出國前點選下方語音包即可一次備妥。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
            <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              已快取 {totalCachedCount} / {allAudioTotal} 支
            </span>
            {storageMb && (
              <span className="text-slate-400 font-medium">（約 {storageMb.usedMb} MB）</span>
            )}
          </div>
          <button
            onClick={refreshStats}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="重新整理快取狀態"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-900 flex items-center justify-between gap-2">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-indigo-500 hover:text-indigo-800"
            aria-label="關閉訊息"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3.5">
        {packs.map((pack) => {
          const cachedCount = countCachedPaths(pack.urls, cachedSet);
          const totalCount = pack.urls.length;
          const isComplete = totalCount > 0 && cachedCount >= totalCount;
          const isDownloadingThis = activePackId === pack.id;
          const pct = isDownloadingThis && progress
            ? Math.round((progress.completed / Math.max(1, progress.total)) * 100)
            : Math.round((cachedCount / Math.max(1, totalCount)) * 100);

          return (
            <div
              key={pack.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${
                isComplete
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{pack.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {pack.subtitle}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                    {pack.approxMb}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className={isComplete ? 'text-emerald-700' : 'text-slate-600'}>
                      {isDownloadingThis && progress
                        ? `下載中 ${progress.completed} / ${progress.total} 支...`
                        : isComplete
                        ? `✅ 已離線就緒（${totalCount} 支）`
                        : `已快取 ${cachedCount} / ${totalCount} 支`}
                    </span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isDownloadingThis ? (
                  <button
                    onClick={handleCancel}
                    className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 取消下載
                  </button>
                ) : isComplete ? (
                  <div className="w-full py-2 rounded-xl bg-emerald-100/80 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 離線可用
                  </div>
                ) : (
                  <button
                    onClick={() => handleDownloadPack(pack)}
                    disabled={Boolean(activePackId) || !isOnline}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    {!isOnline ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5" /> 連線後可下載
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" /> 下載離線語音包（{pack.approxMb}）
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {optionalCachedCount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>若想釋放手機空間，可清除選配音檔（系統會自動保留 22 支急救卡語音）。</span>
          <button
            onClick={handleClearOptional}
            disabled={clearing || Boolean(activePackId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:text-rose-700 text-slate-600 font-semibold transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? '清除中...' : '清除選配快取'}
          </button>
        </div>
      )}
    </section>
  );
}
