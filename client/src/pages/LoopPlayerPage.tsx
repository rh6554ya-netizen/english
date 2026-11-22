import { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Headphones,
  Moon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { api, type HydratedPlaylist, type HydratedPlaylistTrack } from '../lib/api';
import { playAudio, sleep, stopAllAudio } from '../lib/audio';

type RecipePreset = 'classic' | 'repeat4' | 'blind_en';

const PRESETS: { id: RecipePreset; name: string; desc: string }[] = [
  { id: 'classic', name: '經典三軌模式', desc: '英文常速 ×1 ➜ 英文慢速 ×1 ➜ 中文講解 ×1' },
  { id: 'repeat4', name: '強化語感模式', desc: '單句英文常速連播 ×4（磨出自然語感）' },
  { id: 'blind_en', name: '純英盲聽模式', desc: '全英文常速連續播放，訓練直接聽懂' },
];

export function LoopPlayerPage() {
  const [playlists, setPlaylists] = useState<HydratedPlaylist[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [recipe, setRecipe] = useState<RecipePreset>('classic');
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState('待命中');
  const [sleepMin, setSleepMin] = useState<number>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);

  const stopRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    api.getPlaylists().then((r) => {
      setPlaylists(r.playlists);
      if (r.playlists[0]) setSelectedId(r.playlists[0].id);
    });
    return () => {
      stopRef.current = true;
      stopAllAudio();
    };
  }, []);

  // Sleep timer countdown
  useEffect(() => {
    if (!isPlaying || sleepRemainingSec <= 0) return;
    const id = setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev <= 1) {
          handleStop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, sleepRemainingSec]);

  const activePlaylist = playlists.find((p) => p.id === selectedId) || playlists[0];
  const tracks: HydratedPlaylistTrack[] = activePlaylist?.tracks || [];
  const currentTrack = tracks[trackIndex];

  const handleStop = () => {
    stopRef.current = true;
    stopAllAudio();
    setIsPlaying(false);
    setPhaseLabel('已暫停');
    if (sessionStartRef.current && activePlaylist) {
      const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
      sessionStartRef.current = null;
      if (elapsed >= 5) {
        api.logPractice({
          activity_type: 'loop_listening',
          target_type: 'playlist',
          target_id: activePlaylist.id,
          duration_seconds: elapsed,
          detail_json: { recipe },
        });
      }
    }
  };

  const runLoopFrom = async (startIdx: number) => {
    if (!tracks.length) return;
    stopRef.current = false;
    setIsPlaying(true);
    sessionStartRef.current = Date.now();
    if (sleepMin > 0 && sleepRemainingSec === 0) {
      setSleepRemainingSec(sleepMin * 60);
    }

    let idx = startIdx;
    while (!stopRef.current) {
      const tr = tracks[idx];
      if (!tr) break;
      setTrackIndex(idx);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: tr.text_en,
          artist: activePlaylist?.title_zh || 'EchoSpeak 磨耳朵',
          album: tr.label,
        });
      }

      const steps =
        recipe === 'classic'
          ? [
              { label: '🇺🇸 英文常速', url: tr.audio_normal_url, text: tr.text_en, lang: 'en-US' as const, rate: 1.0, pause: 600 },
              { label: '🐢 英文慢速', url: tr.audio_slow_url, text: tr.text_en, lang: 'en-US' as const, rate: 0.75, pause: 600 },
              { label: '🇹🇼 中文講解', url: tr.audio_zh_url, text: tr.text_zh, lang: 'zh-TW' as const, rate: 1.0, pause: 900 },
            ]
          : recipe === 'repeat4'
          ? [1, 2, 3, 4].map((n) => ({
              label: `🔁 強化連播 (${n}/4)`,
              url: tr.audio_normal_url,
              text: tr.text_en,
              lang: 'en-US' as const,
              rate: 1.0,
              pause: 450,
            }))
          : [
              { label: '🎧 純英盲聽', url: tr.audio_normal_url, text: tr.text_en, lang: 'en-US' as const, rate: 1.0, pause: 700 },
            ];

      for (const s of steps) {
        if (stopRef.current) break;
        setPhaseLabel(s.label);
        await playAudio({
          url: s.url,
          fallbackText: s.text,
          lang: s.lang,
          rate: s.url ? 1.0 : s.rate,
        });
        if (!stopRef.current) await sleep(s.pause);
      }

      idx = (idx + 1) % tracks.length;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      handleStop();
    } else {
      runLoopFrom(trackIndex);
    }
  };

  const jumpTrack = (nextIdx: number) => {
    const safeIdx = (nextIdx + tracks.length) % tracks.length;
    setTrackIndex(safeIdx);
    if (isPlaying) {
      stopRef.current = true;
      stopAllAudio();
      setTimeout(() => runLoopFrom(safeIdx), 120);
    }
  };

  const bookmarkCurrent = async () => {
    if (!currentTrack) return;
    const res = await api.addSrsCard({
      item_type: currentTrack.item_type === 'exercise' ? 'exercise' : 'dialogue_turn',
      item_id: currentTrack.item_id,
      front_zh: currentTrack.text_zh,
      back_en: currentTrack.text_en,
      audio_url: currentTrack.audio_normal_url,
      personal_note: `磨耳朵收藏 · ${activePlaylist?.title_zh || ''}`,
    });
    setToast(res.already_exists ? '此句已在 SRS 複習庫中' : '已一鍵收藏至 SRS 複習庫！');
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">沉浸式「磨耳朵」循環播放器</h1>
        <p className="text-sm text-slate-500 mt-1">
          還原「常速 ➜ 較慢速 ➜ 中文」三軌循環節奏，支援自訂播放腳本與睡眠定時
        </p>
      </div>

      {/* Playlist selector */}
      <div className="grid md:grid-cols-3 gap-4">
        {playlists.map((pl) => (
          <button
            key={pl.id}
            onClick={() => {
              handleStop();
              setSelectedId(pl.id);
              setTrackIndex(0);
            }}
            className={`text-left p-4 rounded-2xl border transition ${
              activePlaylist?.id === pl.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-white border-slate-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>🎧 官方歌單</span>
              <span>{pl.tracks.length} 句</span>
            </div>
            <div className="font-extrabold text-sm mt-2">{pl.title_zh}</div>
            <p
              className={`text-xs mt-1 line-clamp-2 ${
                activePlaylist?.id === pl.id ? 'text-indigo-100' : 'text-slate-500'
              }`}
            >
              {pl.description}
            </p>
          </button>
        ))}
      </div>

      {/* Main Player Console */}
      <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200">
            <Headphones className="w-3.5 h-3.5" />
            <span>{phaseLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Moon className="w-3.5 h-3.5 text-amber-300" />
            <span>睡眠定時：</span>
            {[0, 15, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setSleepMin(m);
                  setSleepRemainingSec(m * 60);
                }}
                className={`px-2.5 py-1 rounded-full font-bold transition ${
                  sleepMin === m ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                }`}
              >
                {m === 0 ? '關' : `${m}分`}
              </button>
            ))}
            {sleepRemainingSec > 0 && isPlaying && (
              <span className="font-mono text-amber-300 ml-1">
                {Math.floor(sleepRemainingSec / 60)}:
                {String(sleepRemainingSec % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        {/* Now Playing Display */}
        {currentTrack && (
          <div className="py-4 text-center space-y-2.5">
            <div className="text-xs font-semibold text-indigo-300">
              {trackIndex + 1} / {tracks.length} · {currentTrack.label}
            </div>
            {currentTrack.prompt_en && (
              <div className="text-sm text-slate-400">Q: {currentTrack.prompt_en}</div>
            )}
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug max-w-2xl mx-auto">
              {currentTrack.text_en}
            </div>
            {recipe !== 'blind_en' && (
              <div className="text-base text-slate-300">{currentTrack.text_zh}</div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => jumpTrack(trackIndex - 1)}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition"
            title="上一句"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 transition"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={() => jumpTrack(trackIndex + 1)}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition"
            title="下一句"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={bookmarkCurrent}
            className="p-3 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition"
            title="一鍵收藏此句至 SRS"
          >
            <BookmarkPlus className="w-5 h-5" />
          </button>
        </div>

        {/* Recipe selector */}
        <div className="grid sm:grid-cols-3 gap-2.5 pt-4 border-t border-white/10">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setRecipe(p.id);
                if (isPlaying) {
                  stopRef.current = true;
                  stopAllAudio();
                  setTimeout(() => runLoopFrom(trackIndex), 150);
                }
              }}
              className={`text-left p-3 rounded-xl border transition ${
                recipe === p.id
                  ? 'bg-white/15 border-indigo-400 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <div className="text-xs font-bold">{p.name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Track List */}
      <section className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {tracks.map((tr, i) => (
          <button
            key={tr.playlist_item_id}
            onClick={() => {
              setTrackIndex(i);
              runLoopFrom(i);
            }}
            className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition ${
              i === trackIndex ? 'bg-indigo-50/60' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  i === trackIndex
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 truncate">{tr.text_en}</div>
                <div className="text-xs text-slate-500 truncate">{tr.text_zh}</div>
              </div>
            </div>
            <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        ))}
      </section>
    </div>
  );
}
