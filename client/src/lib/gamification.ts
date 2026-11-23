import type {
  UserAiSession,
  UserGamification,
  UserPracticeLog,
  UserProfile,
  UserScenarioProgress,
  UserSrsCard,
} from '../../../shared/types';

export interface GamificationInputs {
  user: UserProfile;
  progress: UserScenarioProgress[];
  logs: UserPracticeLog[];
  srsCards: UserSrsCard[];
  aiSessions: UserAiSession[];
  saved: UserGamification | null;
}

export interface ChallengeDaySpec {
  day: number;
  title_zh: string;
  subtitle_zh: string;
  task_desc_zh: string;
  action_label: string;
  action_to: string;
  checkCompleted: (inputs: GamificationInputs) => { done: boolean; progressText: string };
}

export interface AchievementBadgeSpec {
  id: string;
  emoji: string;
  title_zh: string;
  desc_zh: string;
  category: 'speaking' | 'listening' | 'habit' | 'challenge';
  checkUnlocked: (inputs: GamificationInputs, sprintDoneDays: number) => {
    unlocked: boolean;
    current: number;
    target: number;
  };
}

function hasScenarioStudied(progress: UserScenarioProgress[], scenarioId: string): boolean {
  const p = progress.find((x) => x.scenario_id === scenarioId);
  if (!p) return false;
  return p.completion_percent >= 25 || p.step1_blind_listen_done || p.step2_study_done || p.step3_shadowing_done;
}

export const TRAVEL_SPRINT_DAYS: ChallengeDaySpec[] = [
  {
    day: 1,
    title_zh: '機場劃位與海關通關',
    subtitle_zh: '出國第一關不緊張',
    task_desc_zh: '完成「機場劃位、託運與入境查驗」任一步驟（或完成機場 AI 角色扮演）',
    action_label: '前往機場情境課',
    action_to: '/studio/airport-check-in-customs',
    checkCompleted: ({ progress, aiSessions }) => {
      const done =
        hasScenarioStudied(progress, 'scn-airport') ||
        aiSessions.some((s) => s.scenario_id === 'scn-airport');
      return { done, progressText: done ? '已完成機場通關練習' : '尚未開始機場情境' };
    },
  },
  {
    day: 2,
    title_zh: '飯店 Check-in 實戰演練',
    subtitle_zh: '押金、Wi-Fi 與房務溝通',
    task_desc_zh: '完成「飯店入住 Check-in」情境學習，或進行 1 場飯店 AI 實境角色扮演',
    action_label: '前往飯店 AI 扮演',
    action_to: '/ai-roleplay?preset=rp-hotel',
    checkCompleted: ({ progress, aiSessions }) => {
      const done =
        hasScenarioStudied(progress, 'scn-hotel') ||
        aiSessions.some((s) => s.scenario_id === 'scn-hotel');
      return { done, progressText: done ? '已完成飯店入住任務' : '完成飯店情境課或 AI 扮演即可過關' };
    },
  },
  {
    day: 3,
    title_zh: '交通問路 × 3 秒直覺反應',
    subtitle_zh: '跳錶、刷卡與快速開口',
    task_desc_zh: '完成「計程車與問路」情境學習，或累計完成 5 題以上 3 秒反應訓練',
    action_label: '開啟 3 秒反應訓練',
    action_to: '/quick-drill',
    checkCompleted: ({ progress, logs }) => {
      const quickCount = logs.filter((l) => l.activity_type === 'quick_3s').length;
      const done = hasScenarioStudied(progress, 'scn-transport') || quickCount >= 5;
      return {
        done,
        progressText: done ? '已完成交通與反應訓練' : `3 秒反應進度 ${Math.min(quickCount, 5)}/5 題`,
      };
    },
  },
  {
    day: 4,
    title_zh: '餐廳點餐 × AI 發音打磨',
    subtitle_zh: '食物過敏說明與美式連音',
    task_desc_zh: '完成「餐廳點餐」情境學習，或完成 1 次 Step 3 AI 發音評測',
    action_label: '前往餐廳 Step 3 評測',
    action_to: '/studio/restaurant-ordering-allergy',
    checkCompleted: ({ progress, logs }) => {
      const pronCount = logs.filter((l) => l.activity_type === 'pronunciation_check').length;
      const done = hasScenarioStudied(progress, 'scn-restaurant') || pronCount >= 1;
      return {
        done,
        progressText: done ? '已完成點餐／發音任務' : `AI 發音評測 ${pronCount}/1 次`,
      };
    },
  },
  {
    day: 5,
    title_zh: '血拼試穿與退換貨議價',
    subtitle_zh: '尺寸版型詞槽靈活替換',
    task_desc_zh: '完成「服飾選購與試穿」情境學習，或完成 1 場購物 AI 角色扮演',
    action_label: '前往購物情境課',
    action_to: '/studio/shopping-trying-checkout',
    checkCompleted: ({ progress, aiSessions }) => {
      const done =
        hasScenarioStudied(progress, 'scn-shopping') ||
        aiSessions.some((s) => s.scenario_id === 'scn-shopping');
      return { done, progressText: done ? '已完成購物試穿任務' : '尚未開始購物情境' };
    },
  },
  {
    day: 6,
    title_zh: '就醫求助與離線急救包',
    subtitle_zh: '出國最安心的自保防線',
    task_desc_zh: '完成「身體不適與藥局溝通」情境課，或收藏至少 3 張 SRS 急救複習卡',
    action_label: '查看藥局課／急救卡',
    action_to: '/studio/doctor-headache-pharmacy',
    checkCompleted: ({ progress, srsCards }) => {
      const done = hasScenarioStudied(progress, 'scn-health') || srsCards.length >= 3;
      return {
        done,
        progressText: done ? '已完成自保與急救準備' : `SRS 收藏進度 ${Math.min(srsCards.length, 3)}/3 張`,
      };
    },
  },
  {
    day: 7,
    title_zh: '出國實戰大考驗',
    subtitle_zh: 'AI 自由對話總驗收',
    task_desc_zh: '累計完成至少 2 場 AI 實境口說角色扮演（完成總評）',
    action_label: '開始 AI 實戰驗收',
    action_to: '/ai-roleplay',
    checkCompleted: ({ aiSessions }) => {
      const evaluated = aiSessions.filter((s) => Boolean(s.report)).length;
      const done = evaluated >= 2;
      return {
        done,
        progressText: `已完成 ${Math.min(evaluated, 2)}/2 場 AI 實戰總評`,
      };
    },
  },
];

export const ACHIEVEMENT_BADGES: AchievementBadgeSpec[] = [
  {
    id: 'first-ai-chat',
    emoji: '🎙️',
    title_zh: '初次破冰開口',
    desc_zh: '完成第 1 場 AI 實境口說角色扮演並取得總評',
    category: 'speaking',
    checkUnlocked: ({ aiSessions }) => {
      const c = aiSessions.filter((s) => Boolean(s.report)).length;
      return { unlocked: c >= 1, current: Math.min(c, 1), target: 1 };
    },
  },
  {
    id: 'roleplay-veteran',
    emoji: '🗽',
    title_zh: '實境對話老手',
    desc_zh: '累計完成 5 場 AI 實境口說角色扮演',
    category: 'speaking',
    checkUnlocked: ({ aiSessions }) => {
      const c = aiSessions.filter((s) => Boolean(s.report)).length;
      return { unlocked: c >= 5, current: Math.min(c, 5), target: 5 };
    },
  },
  {
    id: 'native-vibe-master',
    emoji: '🇺🇸',
    title_zh: '道地美式達人',
    desc_zh: '單場 AI 角色扮演「美式自然度」達 85 分以上',
    category: 'speaking',
    checkUnlocked: ({ aiSessions }) => {
      const best = aiSessions.reduce((m, s) => Math.max(m, s.report?.naturalness_score || 0), 0);
      return { unlocked: best >= 85, current: Math.min(best, 85), target: 85 };
    },
  },
  {
    id: 'pronunciation-star',
    emoji: '🗣️',
    title_zh: '發音模範生',
    desc_zh: 'Step 3 AI 發音評測單次得分達 85 分以上',
    category: 'speaking',
    checkUnlocked: ({ logs }) => {
      const best = logs
        .filter((l) => l.activity_type === 'pronunciation_check')
        .reduce((m, l) => Math.max(m, l.score || 0), 0);
      return { unlocked: best >= 85, current: Math.min(best, 85), target: 85 };
    },
  },
  {
    id: 'pronunciation-coach-3',
    emoji: '🎧',
    title_zh: '跟讀打磨師',
    desc_zh: '累計完成 3 次 Step 3 AI 發音與連音評測',
    category: 'speaking',
    checkUnlocked: ({ logs }) => {
      const c = logs.filter((l) => l.activity_type === 'pronunciation_check').length;
      return { unlocked: c >= 3, current: Math.min(c, 3), target: 3 };
    },
  },
  {
    id: 'quick-3s-spark',
    emoji: '⚡',
    title_zh: '3 秒閃電反應',
    desc_zh: '在 3 秒反應訓練中累積 10 題「秒答」',
    category: 'listening',
    checkUnlocked: ({ logs }) => {
      const c = logs.filter((l) => l.activity_type === 'quick_3s' && (l.score || 0) >= 90).length;
      return { unlocked: c >= 10, current: Math.min(c, 10), target: 10 };
    },
  },
  {
    id: 'loop-marathon',
    emoji: '🎵',
    title_zh: '磨耳朵馬拉松',
    desc_zh: '累計磨耳朵循環聽力達 30 分鐘',
    category: 'listening',
    checkUnlocked: ({ logs }) => {
      const mins = Math.round(
        logs
          .filter((l) => l.activity_type === 'loop_listening')
          .reduce((s, l) => s + l.duration_seconds, 0) / 60
      );
      return { unlocked: mins >= 30, current: Math.min(mins, 30), target: 30 };
    },
  },
  {
    id: 'srs-architect',
    emoji: '🗂️',
    title_zh: '記憶建築師',
    desc_zh: '於 SRS 複習庫收藏達 10 張個人專屬句子／單字卡',
    category: 'habit',
    checkUnlocked: ({ srsCards }) => {
      const c = srsCards.length;
      return { unlocked: c >= 10, current: Math.min(c, 10), target: 10 };
    },
  },
  {
    id: 'scenario-explorer',
    emoji: '🗺️',
    title_zh: '情境探索者',
    desc_zh: '完成至少 3 課四步驟實戰情境（100% 通關）',
    category: 'habit',
    checkUnlocked: ({ progress }) => {
      const c = progress.filter((p) => p.completion_percent >= 100).length;
      return { unlocked: c >= 3, current: Math.min(c, 3), target: 3 };
    },
  },
  {
    id: 'streak-3',
    emoji: '🔥',
    title_zh: '三日不間斷',
    desc_zh: '達成連續 3 天開口練習打卡',
    category: 'habit',
    checkUnlocked: ({ user }) => {
      const c = user.streak_days || 0;
      return { unlocked: c >= 3, current: Math.min(c, 3), target: 3 };
    },
  },
  {
    id: 'streak-7',
    emoji: '🏆',
    title_zh: '七日黃金習慣',
    desc_zh: '達成連續 7 天學習打卡',
    category: 'habit',
    checkUnlocked: ({ user }) => {
      const c = user.streak_days || 0;
      return { unlocked: c >= 7, current: Math.min(c, 7), target: 7 };
    },
  },
  {
    id: 'sprint-7d-graduate',
    emoji: '🎓',
    title_zh: '旅遊英文衝刺結業',
    desc_zh: '完成「7 天旅遊英文衝刺營」全部 7 日實戰任務',
    category: 'challenge',
    checkUnlocked: (_inputs, sprintDoneDays) => ({
      unlocked: sprintDoneDays >= 7,
      current: Math.min(sprintDoneDays, 7),
      target: 7,
    }),
  },
];

export interface ComputedGamification {
  days: (ChallengeDaySpec & { done: boolean; progressText: string })[];
  completedDaysCount: number;
  badges: (AchievementBadgeSpec & {
    unlocked: boolean;
    unlockedAt: string | null;
    current: number;
    target: number;
  })[];
  unlockedCount: number;
  newlyUnlockedIds: string[];
  nextRecord: UserGamification;
}

export function evaluateGamification(inputs: GamificationInputs): ComputedGamification {
  const nowIso = new Date().toISOString();
  const days = TRAVEL_SPRINT_DAYS.map((spec) => {
    const res = spec.checkCompleted(inputs);
    return { ...spec, ...res };
  });

  const completedDayNumbers = days.filter((d) => d.done).map((d) => d.day);
  const completedDaysCount = completedDayNumbers.length;

  const existingBadgeMap = new Map(
    (inputs.saved?.unlocked_badges || []).map((b) => [b.badge_id, b.unlocked_at])
  );

  const newlyUnlockedIds: string[] = [];
  const nextBadgeRecords = [...(inputs.saved?.unlocked_badges || [])];

  const badges = ACHIEVEMENT_BADGES.map((spec) => {
    const res = spec.checkUnlocked(inputs, completedDaysCount);
    const prevUnlockedAt = existingBadgeMap.get(spec.id) || null;
    const unlocked = Boolean(prevUnlockedAt) || res.unlocked;
    let unlockedAt = prevUnlockedAt;

    if (unlocked && !prevUnlockedAt) {
      unlockedAt = nowIso;
      newlyUnlockedIds.push(spec.id);
      nextBadgeRecords.push({ badge_id: spec.id, unlocked_at: nowIso });
    }

    return {
      ...spec,
      unlocked,
      unlockedAt,
      current: unlocked ? spec.checkUnlocked(inputs, completedDaysCount).target : res.current,
      target: res.target,
    };
  });

  const prevChallenge = inputs.saved?.challenge_7d;
  const startedAt =
    prevChallenge?.started_at || (completedDaysCount > 0 ? nowIso : null);
  const completedAt =
    prevChallenge?.completed_at || (completedDaysCount >= 7 ? nowIso : null);

  const nextRecord: UserGamification = {
    id: inputs.user.id,
    user_id: inputs.user.id,
    unlocked_badges: nextBadgeRecords,
    challenge_7d: {
      started_at: startedAt,
      completed_days: completedDayNumbers,
      completed_at: completedAt,
    },
    updated_at: nowIso,
  };

  return {
    days,
    completedDaysCount,
    badges,
    unlockedCount: badges.filter((b) => b.unlocked).length,
    newlyUnlockedIds,
    nextRecord,
  };
}
