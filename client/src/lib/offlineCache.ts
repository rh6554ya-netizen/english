import seedData from '../../../data/seed-notebooklm.json';
import type { DatabaseState, Exercise } from '../../../shared/types';
import { resolveAudioUrl } from './audio';

const typedSeed = seedData as unknown as DatabaseState;

function getExerciseAudioUrls(e: Exercise): (string | null | undefined)[] {
  return [
    e.prompt_audio_url,
    e.answer_audio_normal_url,
    e.answer_audio_slow_url,
    e.answer_audio_zh_url,
  ];
}

export const AUDIO_CACHE_NAME = 'echospeak-audio-v1';

export interface DownloadProgress {
  completed: number;
  total: number;
  failed: number;
  skipped: number;
}

export interface OfflinePackDefinition {
  id: 'survival' | 'essential_scenarios' | 'business_pack' | 'quick_drill' | 'all';
  title: string;
  subtitle: string;
  approxMb: string;
  urls: string[];
}

const SURVIVAL_AUDIO_PATHS: string[] = Array.from({ length: 11 }, (_, idx) => {
  const n = idx + 1;
  return [`/audio/survival/surv-${n}_normal.mp3`, `/audio/survival/surv-${n}_slow.mp3`];
}).flat();

function dedupeAudioPaths(paths: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    if (typeof p === 'string' && p.trim().endsWith('.mp3')) {
      out.add(p.trim());
    }
  }
  return [...out];
}

export function toAbsoluteAudioUrl(rawPath: string): string {
  const resolved = resolveAudioUrl(rawPath);
  if (typeof window === 'undefined') return resolved;
  return new URL(resolved, window.location.origin).toString();
}

export function getSurvivalAudioPaths(): string[] {
  return [...SURVIVAL_AUDIO_PATHS];
}

export function getScenarioAudioPaths(scenarioId: string): string[] {
  const dialogueIds = new Set(
    typedSeed.dialogues.filter((d) => d.scenario_id === scenarioId).map((d) => d.id)
  );
  const turns = typedSeed.dialogue_turns.filter((t) => dialogueIds.has(t.dialogue_id));
  const turnIds = new Set(turns.map((t) => t.id));
  const vocabIds = new Set(
    typedSeed.dialogue_turn_vocabulary
      .filter((link) => turnIds.has(link.dialogue_turn_id))
      .map((link) => link.vocabulary_id)
  );
  const vocab = typedSeed.vocabulary.filter((v) => vocabIds.has(v.id));
  const patterns = typedSeed.sentence_patterns.filter((p) => p.scenario_id === scenarioId);
  const exercises = typedSeed.exercises.filter((e) => e.scenario_id === scenarioId);

  return dedupeAudioPaths([
    ...turns.flatMap((t) => [t.audio_normal_url, t.audio_slow_url, t.audio_zh_url]),
    ...vocab.map((v) => v.audio_url),
    ...patterns.flatMap((p) => [p.audio_normal_url, p.audio_slow_url]),
    ...exercises.flatMap(getExerciseAudioUrls),
  ]);
}

export function getEssentialScenariosAudioPaths(): string[] {
  const essentialIds = typedSeed.scenarios
    .filter((s) => s.is_survival_essential)
    .map((s) => s.id);
  return dedupeAudioPaths([
    ...SURVIVAL_AUDIO_PATHS,
    ...essentialIds.flatMap((id) => getScenarioAudioPaths(id)),
  ]);
}

export function getBusinessPackAudioPaths(): string[] {
  const businessIds = [
    'scn-meeting',
    'scn-project',
    'scn-schedule',
    'scn-interview',
    'scn-phone',
  ];
  const businessGroupIds = new Set(
    typedSeed.expression_groups
      .filter((g) => g.scenario_id && businessIds.includes(g.scenario_id))
      .map((g) => g.id)
  );
  const businessExprs = typedSeed.expressions.filter((e) => businessGroupIds.has(e.group_id));
  return dedupeAudioPaths([
    ...businessIds.flatMap((id) => getScenarioAudioPaths(id)),
    ...businessExprs.flatMap((e) => [e.audio_normal_url, e.audio_slow_url]),
  ]);
}

export function getQuickDrillAudioPaths(): string[] {
  return dedupeAudioPaths(
    typedSeed.exercises
      .filter((e) => e.exercise_type === 'quick_response_3s')
      .flatMap(getExerciseAudioUrls)
  );
}

export function getAllAudioPaths(): string[] {
  return dedupeAudioPaths([
    ...SURVIVAL_AUDIO_PATHS,
    ...typedSeed.dialogue_turns.flatMap((t) => [
      t.audio_normal_url,
      t.audio_slow_url,
      t.audio_zh_url,
    ]),
    ...typedSeed.vocabulary.map((v) => v.audio_url),
    ...typedSeed.sentence_patterns.flatMap((p) => [p.audio_normal_url, p.audio_slow_url]),
    ...typedSeed.expressions.flatMap((e) => [e.audio_normal_url, e.audio_slow_url]),
    ...typedSeed.exercises.flatMap(getExerciseAudioUrls),
  ]);
}

export function getOfflinePacks(): OfflinePackDefinition[] {
  const survivalUrls = getSurvivalAudioPaths();
  const essentialUrls = getEssentialScenariosAudioPaths();
  const businessUrls = getBusinessPackAudioPaths();
  const quickDrillUrls = getQuickDrillAudioPaths();
  const allUrls = getAllAudioPaths();
  const totalScenarios = typedSeed.scenarios.length;
  const totalQuickDrills = typedSeed.exercises.filter(
    (e) => e.exercise_type === 'quick_response_3s'
  ).length;

  return [
    {
      id: 'survival',
      title: '隨身急救卡語音包',
      subtitle: '海關、過敏、護照遺失、就醫、報警與購物 11 句常速＋慢速語音（安裝後預設自動快取）',
      approxMb: '0.8 MB',
      urls: survivalUrls,
    },
    {
      id: 'essential_scenarios',
      title: '出國旅遊必備情境包',
      subtitle: '急救卡＋機場入境、飯店入住、餐廳點餐、藥局就醫、購物與問路等高頻旅遊情境全部音檔',
      approxMb: '7.5 MB',
      urls: essentialUrls,
    },
    {
      id: 'business_pack',
      title: '💼 職場商務英語實戰包',
      subtitle: '開會反對、專案協調、日程改期、英文面試與商務電話 5 大職場課＋16 題職場快問快答',
      approxMb: '8.6 MB',
      urls: businessUrls,
    },
    {
      id: 'quick_drill',
      title: `3 秒直覺反應 ${totalQuickDrills} 題包`,
      subtitle: `全部 ${totalQuickDrills} 組生活與職場高頻 Q&A 提問與美式標準回覆音檔，搭機或通勤離線刷題`,
      approxMb: '5.9 MB',
      urls: quickDrillUrls,
    },
    {
      id: 'all',
      title: '完整離線教材包（全站）',
      subtitle: `一次下載全站 ${totalScenarios} 大情境、${totalQuickDrills} 組問答、單字、萬用句型、美式升級表達與急救卡`,
      approxMb: '24.4 MB',
      urls: allUrls,
    },
  ];
}

export function isCacheApiSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export async function getCachedAudioUrlSet(): Promise<Set<string>> {
  if (!isCacheApiSupported()) return new Set();
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const requests = await cache.keys();
    return new Set(
      requests.map((req) => {
        const u = new URL(req.url);
        return `${u.origin}${u.pathname}`;
      })
    );
  } catch {
    return new Set();
  }
}

export function countCachedPaths(paths: string[], cachedUrlSet: Set<string>): number {
  let count = 0;
  for (const p of paths) {
    if (cachedUrlSet.has(toAbsoluteAudioUrl(p))) {
      count += 1;
    }
  }
  return count;
}

export async function cacheAudioPaths(
  paths: string[],
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<DownloadProgress> {
  const uniquePaths = dedupeAudioPaths(paths);
  const total = uniquePaths.length;
  const progress: DownloadProgress = { completed: 0, total, failed: 0, skipped: 0 };

  if (!isCacheApiSupported() || total === 0) {
    onProgress?.(progress);
    return progress;
  }

  const cache = await caches.open(AUDIO_CACHE_NAME);
  const existingSet = await getCachedAudioUrlSet();

  const queue: string[] = [];
  for (const rawPath of uniquePaths) {
    const absUrl = toAbsoluteAudioUrl(rawPath);
    if (existingSet.has(absUrl)) {
      progress.completed += 1;
      progress.skipped += 1;
    } else {
      queue.push(absUrl);
    }
  }
  onProgress?.({ ...progress });

  if (queue.length === 0) return progress;

  let cursor = 0;
  const CONCURRENCY = 6;

  async function worker() {
    while (cursor < queue.length) {
      if (signal?.aborted) break;
      const idx = cursor++;
      const url = queue[idx];
      try {
        const res = await fetch(url, {
          mode: 'cors',
          credentials: 'same-origin',
          signal,
        });
        if (res.ok && res.status === 200) {
          await cache.put(url, res);
          progress.completed += 1;
        } else {
          progress.failed += 1;
        }
      } catch {
        if (signal?.aborted) break;
        progress.failed += 1;
      }
      onProgress?.({ ...progress });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
  return progress;
}

export async function clearAudioCache(keepSurvival = true): Promise<void> {
  if (!isCacheApiSupported()) return;
  const cache = await caches.open(AUDIO_CACHE_NAME);
  if (!keepSurvival) {
    await caches.delete(AUDIO_CACHE_NAME);
    return;
  }

  const survivalSet = new Set(getSurvivalAudioPaths().map(toAbsoluteAudioUrl));
  const keys = await cache.keys();
  await Promise.all(
    keys.map((req) => {
      const u = new URL(req.url);
      const canonical = `${u.origin}${u.pathname}`;
      if (survivalSet.has(canonical)) return Promise.resolve(false);
      return cache.delete(req);
    })
  );
}

export async function getStorageEstimateMb(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    if (typeof est.usage !== 'number') return null;
    return {
      usedMb: Number((est.usage / (1024 * 1024)).toFixed(1)),
      quotaMb: est.quota ? Math.round(est.quota / (1024 * 1024)) : 0,
    };
  } catch {
    return null;
  }
}
