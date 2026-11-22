import { Router } from 'express';
import crypto from 'node:crypto';
import { store } from '../db/store.js';
import { calculateSm2 } from '../services/sm2.js';
import { SURVIVAL_PHRASES } from '../data/survivalPhrases.js';
import type {
  ListeningPlaylist,
  PlaylistItem,
  UserPracticeLog,
  UserScenarioProgress,
  UserSrsCard,
} from '../../../shared/types.js';

export const apiRouter = Router();

const DEFAULT_USER_ID = 'demo-user';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function touchUserActivity() {
  const db = store.getState();
  const user = db.users.find((u) => u.id === DEFAULT_USER_ID);
  if (!user) return null;
  const today = todayIsoDate();
  if (user.last_active_date !== today) {
    user.streak_days = (user.streak_days || 0) + 1;
    user.last_active_date = today;
  }
  return user;
}

// 1. Health & status
apiRouter.get('/health', (_req, res) => {
  const db = store.getState();
  res.json({
    ok: true,
    backend: store.getBackendInfo(),
    counts: {
      scenarios: db.scenarios.length,
      dialogues: db.dialogues.length,
      turns: db.dialogue_turns.length,
      vocabulary: db.vocabulary.length,
      patterns: db.sentence_patterns.length,
      expressions: db.expressions.length,
      exercises: db.exercises.length,
      playlists: db.listening_playlists.length,
    },
  });
});

// 2. Dashboard & User Profile
apiRouter.get('/dashboard', (_req, res) => {
  const db = store.getState();
  const user = db.users.find((u) => u.id === DEFAULT_USER_ID) || db.users[0];
  const now = new Date();
  const todayStr = todayIsoDate();

  const userLogs = db.user_practice_logs.filter((l) => l.user_id === user.id);
  const todaySeconds = userLogs
    .filter((l) => l.created_at.slice(0, 10) === todayStr)
    .reduce((sum, l) => sum + l.duration_seconds, 0);
  const listeningSeconds = userLogs
    .filter((l) => l.activity_type === 'loop_listening')
    .reduce((sum, l) => sum + l.duration_seconds, 0);

  const userSrs = db.user_srs_cards.filter((c) => c.user_id === user.id);
  const dueSrsCount = userSrs.filter((c) => new Date(c.next_review_at) <= now).length;

  const progressMap = new Map(
    db.user_scenario_progress
      .filter((p) => p.user_id === user.id)
      .map((p) => [p.scenario_id, p])
  );

  // Recommend scenarios matching user's learning_goal or difficulty_level
  const goalCategoryMap: Record<string, string[]> = {
    travel_solo: ['cat-travel-airport', 'cat-travel-dining', 'cat-shopping-tryon'],
    travel_group: ['cat-shopping-tryon', 'cat-travel-dining', 'cat-travel-airport'],
    daily_life: ['cat-daily-morning', 'cat-daily-kitchen', 'cat-social-park'],
    small_talk: ['cat-social-park', 'cat-social-phone', 'cat-travel-dining'],
  };
  const preferredCats = goalCategoryMap[user.learning_goal] || [];

  const recommended = [...db.scenarios]
    .filter((s) => s.is_published)
    .sort((a, b) => {
      const aMatch = preferredCats.includes(a.category_id) ? 0 : 1;
      const bMatch = preferredCats.includes(b.category_id) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      const aLvl = a.difficulty_level === user.current_level ? 0 : 1;
      const bLvl = b.difficulty_level === user.current_level ? 0 : 1;
      if (aLvl !== bLvl) return aLvl - bLvl;
      return a.sort_order - b.sort_order;
    })
    .slice(0, 4)
    .map((s) => ({
      ...s,
      category: db.categories.find((c) => c.id === s.category_id) || null,
      progress: progressMap.get(s.id) || null,
    }));

  const recentProgress = [...db.user_scenario_progress]
    .filter((p) => p.user_id === user.id)
    .sort((a, b) => b.last_studied_at.localeCompare(a.last_studied_at))[0];

  const continueScenario = recentProgress
    ? db.scenarios.find((s) => s.id === recentProgress.scenario_id) || recommended[0]
    : recommended[0];

  res.json({
    user,
    stats: {
      streak_days: user.streak_days,
      today_minutes: Math.round(todaySeconds / 60),
      listening_minutes: Math.round(listeningSeconds / 60),
      due_srs_count: dueSrsCount,
      total_srs_count: userSrs.length,
      completed_scenarios: db.user_scenario_progress.filter(
        (p) => p.user_id === user.id && p.completion_percent >= 100
      ).length,
      total_scenarios: db.scenarios.filter((s) => s.is_published).length,
    },
    continue_scenario: continueScenario
      ? {
          ...continueScenario,
          progress: progressMap.get(continueScenario.id) || null,
        }
      : null,
    recommended_scenarios: recommended,
    backend: store.getBackendInfo(),
  });
});

apiRouter.patch('/user/profile', async (req, res) => {
  const db = store.getState();
  const user = db.users.find((u) => u.id === DEFAULT_USER_ID);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { display_name, current_level, learning_goal, preferred_accent, daily_goal_minutes } =
    req.body || {};
  if (display_name) user.display_name = String(display_name);
  if (current_level) user.current_level = current_level;
  if (learning_goal) user.learning_goal = learning_goal;
  if (preferred_accent) user.preferred_accent = preferred_accent;
  if (typeof daily_goal_minutes === 'number') user.daily_goal_minutes = daily_goal_minutes;

  await store.saveCollection('users', [user as unknown as Record<string, unknown>]);
  res.json({ user });
});

// 3. Categories & Scenarios
apiRouter.get('/categories', (_req, res) => {
  const db = store.getState();
  const roots = db.categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((root) => {
      const children = db.categories
        .filter((c) => c.parent_id === root.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const childIds = [root.id, ...children.map((c) => c.id)];
      const scenario_count = db.scenarios.filter(
        (s) => s.is_published && childIds.includes(s.category_id)
      ).length;
      return { ...root, children, scenario_count };
    });
  res.json({ categories: roots, flat: db.categories });
});

apiRouter.get('/scenarios', (req, res) => {
  const db = store.getState();
  const { category, difficulty, travel_mode, search, survival_only } = req.query;

  let catIds: string[] | null = null;
  if (category && typeof category === 'string' && category !== 'all') {
    const target = db.categories.find((c) => c.slug === category || c.id === category);
    if (target) {
      const children = db.categories.filter((c) => c.parent_id === target.id).map((c) => c.id);
      catIds = [target.id, ...children];
    }
  }

  const progressMap = new Map(
    db.user_scenario_progress
      .filter((p) => p.user_id === DEFAULT_USER_ID)
      .map((p) => [p.scenario_id, p])
  );

  const items = db.scenarios
    .filter((s) => s.is_published)
    .filter((s) => !catIds || catIds.includes(s.category_id))
    .filter((s) => !difficulty || difficulty === 'all' || s.difficulty_level === difficulty)
    .filter((s) => !travel_mode || travel_mode === 'all' || s.travel_mode === travel_mode)
    .filter((s) => survival_only !== 'true' || s.is_survival_essential)
    .filter((s) => {
      if (!search || typeof search !== 'string') return true;
      const q = search.toLowerCase();
      return (
        s.title_zh.toLowerCase().includes(q) ||
        s.title_en.toLowerCase().includes(q) ||
        s.story_background.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => {
      const cat = db.categories.find((c) => c.id === s.category_id) || null;
      const parentCat = cat?.parent_id
        ? db.categories.find((c) => c.id === cat.parent_id) || null
        : null;
      const dialogues = db.dialogues.filter((d) => d.scenario_id === s.id);
      const patterns = db.sentence_patterns.filter((p) => p.scenario_id === s.id);
      const turnsCount = db.dialogue_turns.filter((t) =>
        dialogues.some((d) => d.id === t.dialogue_id)
      ).length;
      return {
        ...s,
        category: cat,
        parent_category: parentCat,
        dialogue_types: [...new Set(dialogues.map((d) => d.dialogue_type))],
        turns_count: turnsCount,
        patterns_count: patterns.length,
        progress: progressMap.get(s.id) || null,
      };
    });

  res.json({ scenarios: items });
});

apiRouter.get('/scenarios/:slug', (req, res) => {
  const db = store.getState();
  const scenario = db.scenarios.find(
    (s) => s.slug === req.params.slug || s.id === req.params.slug
  );
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  const category = db.categories.find((c) => c.id === scenario.category_id) || null;
  const parentCategory = category?.parent_id
    ? db.categories.find((c) => c.id === category.parent_id) || null
    : null;

  const vocabMap = new Map(db.vocabulary.map((v) => [v.id, v]));

  const dialogues = db.dialogues
    .filter((d) => d.scenario_id === scenario.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => {
      const source = d.source_id
        ? db.content_sources.find((s) => s.id === d.source_id) || null
        : null;
      const turns = db.dialogue_turns
        .filter((t) => t.dialogue_id === d.id)
        .sort((a, b) => a.turn_order - b.turn_order)
        .map((t) => {
          const highlights = db.dialogue_turn_vocabulary
            .filter((dtv) => dtv.dialogue_turn_id === t.id)
            .map((dtv) => ({
              highlight_text: dtv.highlight_text,
              vocabulary: vocabMap.get(dtv.vocabulary_id) || null,
            }))
            .filter((h) => h.vocabulary !== null);
          return { ...t, highlights };
        });
      return { ...d, source, turns };
    });

  const cultural_notes = db.cultural_notes
    .filter((n) => n.scenario_id === scenario.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const sentence_patterns = db.sentence_patterns.filter((p) => p.scenario_id === scenario.id);

  const exercises = db.exercises
    .filter((e) => e.scenario_id === scenario.id && e.exercise_type !== 'quick_response_3s')
    .sort((a, b) => a.sort_order - b.sort_order);

  const progress =
    db.user_scenario_progress.find(
      (p) => p.user_id === DEFAULT_USER_ID && p.scenario_id === scenario.id
    ) || null;

  res.json({
    scenario,
    category,
    parent_category: parentCategory,
    dialogues,
    cultural_notes,
    sentence_patterns,
    exercises,
    progress,
  });
});

apiRouter.post('/scenarios/:id/progress', async (req, res) => {
  const db = store.getState();
  const scenarioId = req.params.id;
  const {
    step1_blind_listen_done,
    step2_study_done,
    step3_shadowing_done,
    step4_quiz_best_score,
    duration_seconds,
  } = req.body || {};

  let prog = db.user_scenario_progress.find(
    (p) => p.user_id === DEFAULT_USER_ID && p.scenario_id === scenarioId
  );

  if (!prog) {
    prog = {
      id: `prog-${DEFAULT_USER_ID}-${scenarioId}`,
      user_id: DEFAULT_USER_ID,
      scenario_id: scenarioId,
      step1_blind_listen_done: false,
      step2_study_done: false,
      step3_shadowing_done: false,
      step4_quiz_best_score: 0,
      completion_percent: 0,
      last_studied_at: new Date().toISOString(),
    };
    db.user_scenario_progress.push(prog);
  }

  if (typeof step1_blind_listen_done === 'boolean') {
    prog.step1_blind_listen_done = prog.step1_blind_listen_done || step1_blind_listen_done;
  }
  if (typeof step2_study_done === 'boolean') {
    prog.step2_study_done = prog.step2_study_done || step2_study_done;
  }
  if (typeof step3_shadowing_done === 'boolean') {
    prog.step3_shadowing_done = prog.step3_shadowing_done || step3_shadowing_done;
  }
  if (typeof step4_quiz_best_score === 'number') {
    prog.step4_quiz_best_score = Math.max(prog.step4_quiz_best_score, step4_quiz_best_score);
  }

  const completedSteps =
    (prog.step1_blind_listen_done ? 25 : 0) +
    (prog.step2_study_done ? 25 : 0) +
    (prog.step3_shadowing_done ? 25 : 0) +
    (prog.step4_quiz_best_score >= 60 ? 25 : 0);
  prog.completion_percent = completedSteps;
  prog.last_studied_at = new Date().toISOString();

  const user = touchUserActivity();
  await store.saveCollection('user_scenario_progress', [
    prog as unknown as Record<string, unknown>,
  ]);
  if (user) {
    await store.saveCollection('users', [user as unknown as Record<string, unknown>]);
  }

  if (typeof duration_seconds === 'number' && duration_seconds > 0) {
    const log: UserPracticeLog = {
      id: `log-${crypto.randomUUID().slice(0, 8)}`,
      user_id: DEFAULT_USER_ID,
      activity_type: typeof step4_quiz_best_score === 'number' ? 'quiz' : 'shadowing',
      target_type: 'scenario',
      target_id: scenarioId,
      duration_seconds,
      score: typeof step4_quiz_best_score === 'number' ? step4_quiz_best_score : null,
      detail_json: {},
      created_at: new Date().toISOString(),
    };
    db.user_practice_logs.push(log);
    await store.saveCollection('user_practice_logs', [log as unknown as Record<string, unknown>]);
  }

  res.json({ progress: prog });
});

// 4. Loop Listening Playlists
apiRouter.get('/playlists', (_req, res) => {
  const db = store.getState();

  const playlists = db.listening_playlists.map((pl) => {
    const rawItems = db.playlist_items
      .filter((i) => i.playlist_id === pl.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const tracks = rawItems
      .map((item) => {
        if (item.item_type === 'dialogue_turn') {
          const t = db.dialogue_turns.find((x) => x.id === item.item_id);
          if (!t) return null;
          return {
            playlist_item_id: item.id,
            item_type: item.item_type,
            item_id: item.item_id,
            label: t.speaker_role,
            prompt_en: null,
            text_en: t.text_en,
            text_zh: t.text_zh,
            audio_normal_url: t.audio_normal_url,
            audio_slow_url: t.audio_slow_url,
            audio_zh_url: t.audio_zh_url,
          };
        }
        if (item.item_type === 'exercise') {
          const ex = db.exercises.find((x) => x.id === item.item_id);
          if (!ex) return null;
          return {
            playlist_item_id: item.id,
            item_type: item.item_type,
            item_id: item.item_id,
            label: ex.situation_tag || '3秒問答',
            prompt_en: ex.prompt_en || null,
            text_en: ex.correct_answer,
            text_zh: ex.correct_answer_zh || ex.prompt_text,
            audio_normal_url: ex.answer_audio_normal_url || null,
            audio_slow_url: ex.answer_audio_slow_url || null,
            audio_zh_url: ex.answer_audio_zh_url || null,
          };
        }
        return null;
      })
      .filter(Boolean);

    return { ...pl, tracks };
  });

  res.json({ playlists });
});

apiRouter.post('/playlists', async (req, res) => {
  const db = store.getState();
  const { title_zh, description, playback_recipe_json, item_ids } = req.body || {};
  if (!title_zh) return res.status(400).json({ error: 'title_zh is required' });

  const playlist: ListeningPlaylist = {
    id: `pl-${crypto.randomUUID().slice(0, 8)}`,
    user_id: DEFAULT_USER_ID,
    title_zh: String(title_zh),
    description: description ? String(description) : null,
    is_system: false,
    playback_recipe_json: playback_recipe_json || {
      name_zh: '經典三軌（常速 ➜ 慢速 ➜ 中文）',
      sequence: [
        { track: 'audio_normal_url', repeat: 1, pause_ms: 600 },
        { track: 'audio_slow_url', repeat: 1, pause_ms: 600 },
        { track: 'audio_zh_url', repeat: 1, pause_ms: 900 },
      ],
      loop_playlist: true,
    },
    created_at: new Date().toISOString(),
  };

  db.listening_playlists.push(playlist);
  await store.saveCollection('listening_playlists', [
    playlist as unknown as Record<string, unknown>,
  ]);

  const newItems: PlaylistItem[] = [];
  if (Array.isArray(item_ids)) {
    item_ids.forEach((entry: { item_type: PlaylistItem['item_type']; item_id: string }, idx) => {
      const pi: PlaylistItem = {
        id: `pli-${crypto.randomUUID().slice(0, 8)}`,
        playlist_id: playlist.id,
        item_type: entry.item_type,
        item_id: entry.item_id,
        sort_order: idx + 1,
      };
      db.playlist_items.push(pi);
      newItems.push(pi);
    });
    if (newItems.length > 0) {
      await store.saveCollection(
        'playlist_items',
        newItems as unknown as Record<string, unknown>[]
      );
    }
  }

  res.status(201).json({ playlist, items_count: newItems.length });
});

// 5. 3-Second Quick-Response Drill
apiRouter.get('/drill/quick-3s', (_req, res) => {
  const db = store.getState();
  const drills = db.exercises
    .filter((e) => e.exercise_type === 'quick_response_3s')
    .sort((a, b) => a.sort_order - b.sort_order);
  res.json({ drills });
});

apiRouter.post('/drill/quick-3s/result', async (req, res) => {
  const db = store.getState();
  const { exercise_id, rating, duration_seconds } = req.body || {};
  // rating: 'instant' | 'hesitated' | 'missed'
  const ex = db.exercises.find((e) => e.id === exercise_id);
  if (!ex) return res.status(404).json({ error: 'Exercise not found' });

  const score = rating === 'instant' ? 100 : rating === 'hesitated' ? 60 : 20;
  const log: UserPracticeLog = {
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    user_id: DEFAULT_USER_ID,
    activity_type: 'quick_3s',
    target_type: null,
    target_id: exercise_id,
    duration_seconds: typeof duration_seconds === 'number' ? duration_seconds : 6,
    score,
    detail_json: { rating },
    created_at: new Date().toISOString(),
  };
  db.user_practice_logs.push(log);
  const user = touchUserActivity();
  await store.saveCollection('user_practice_logs', [log as unknown as Record<string, unknown>]);
  if (user) await store.saveCollection('users', [user as unknown as Record<string, unknown>]);

  let srsCard: UserSrsCard | null = null;
  if (rating === 'hesitated' || rating === 'missed') {
    const existing = db.user_srs_cards.find(
      (c) => c.user_id === DEFAULT_USER_ID && c.item_type === 'exercise' && c.item_id === ex.id
    );
    if (existing) {
      const updated = calculateSm2(existing, rating === 'missed' ? 0 : 3);
      Object.assign(existing, updated);
      srsCard = existing;
    } else {
      srsCard = {
        id: `srs-${crypto.randomUUID().slice(0, 8)}`,
        user_id: DEFAULT_USER_ID,
        item_type: 'exercise',
        item_id: ex.id,
        front_zh: `聽到「${ex.prompt_en}」➜ 回覆：${ex.prompt_text}`,
        back_en: ex.correct_answer,
        ipa: null,
        audio_url: ex.answer_audio_normal_url || null,
        personal_note: ex.explanation_zh || null,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: new Date().toISOString(),
        last_reviewed_at: null,
      };
      db.user_srs_cards.push(srsCard);
    }
    await store.saveCollection('user_srs_cards', [srsCard as unknown as Record<string, unknown>]);
  }

  res.json({ ok: true, srs_added: Boolean(srsCard), srs_card: srsCard });
});

// 6. Patterns & Native Upgrade Expressions
apiRouter.get('/patterns', (_req, res) => {
  const db = store.getState();
  const patterns = db.sentence_patterns.map((p) => {
    const scenario = db.scenarios.find((s) => s.id === p.scenario_id) || null;
    const category = scenario
      ? db.categories.find((c) => c.id === scenario.category_id) || null
      : null;
    return { ...p, scenario_title_zh: scenario?.title_zh || '', category };
  });
  res.json({ patterns });
});

apiRouter.get('/expressions', (_req, res) => {
  const db = store.getState();
  const groups = db.expression_groups.map((g) => ({
    ...g,
    expressions: db.expressions
      .filter((e) => e.group_id === g.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
  res.json({ groups });
});

// 7. Pocket Survival Phrasebook
apiRouter.get('/survival', (_req, res) => {
  const db = store.getState();
  const survivalPatterns = db.sentence_patterns.filter((p) => p.is_survival_essential);
  res.json({
    phrases: SURVIVAL_PHRASES,
    patterns: survivalPatterns,
  });
});

// 8. SRS Review Vault
apiRouter.get('/srs', (_req, res) => {
  const db = store.getState();
  const now = new Date();
  const cards = db.user_srs_cards
    .filter((c) => c.user_id === DEFAULT_USER_ID)
    .sort((a, b) => a.next_review_at.localeCompare(b.next_review_at));
  const due_cards = cards.filter((c) => new Date(c.next_review_at) <= now);
  res.json({ cards, due_count: due_cards.length });
});

apiRouter.post('/srs', async (req, res) => {
  const db = store.getState();
  const { item_type, item_id, front_zh, back_en, ipa, audio_url, personal_note } = req.body || {};
  if (!item_type || !item_id || !front_zh || !back_en) {
    return res.status(400).json({ error: 'Missing required SRS card fields' });
  }

  const existing = db.user_srs_cards.find(
    (c) =>
      c.user_id === DEFAULT_USER_ID && c.item_type === item_type && c.item_id === String(item_id)
  );
  if (existing) {
    return res.json({ card: existing, already_exists: true });
  }

  const card: UserSrsCard = {
    id: `srs-${crypto.randomUUID().slice(0, 8)}`,
    user_id: DEFAULT_USER_ID,
    item_type,
    item_id: String(item_id),
    front_zh: String(front_zh),
    back_en: String(back_en),
    ipa: ipa || null,
    audio_url: audio_url || null,
    personal_note: personal_note || null,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_at: new Date().toISOString(),
    last_reviewed_at: null,
  };
  db.user_srs_cards.push(card);
  await store.saveCollection('user_srs_cards', [card as unknown as Record<string, unknown>]);
  res.status(201).json({ card, already_exists: false });
});

apiRouter.post('/srs/:id/review', async (req, res) => {
  const db = store.getState();
  const card = db.user_srs_cards.find((c) => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'SRS card not found' });

  const { quality } = req.body || {};
  const result = calculateSm2(card, Number(quality ?? 4));
  Object.assign(card, result);

  const log: UserPracticeLog = {
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    user_id: DEFAULT_USER_ID,
    activity_type: 'srs_review',
    target_type: null,
    target_id: card.id,
    duration_seconds: 15,
    score: Number(quality ?? 4) * 20,
    detail_json: { quality },
    created_at: new Date().toISOString(),
  };
  db.user_practice_logs.push(log);
  const user = touchUserActivity();

  await store.saveCollection('user_srs_cards', [card as unknown as Record<string, unknown>]);
  await store.saveCollection('user_practice_logs', [log as unknown as Record<string, unknown>]);
  if (user) await store.saveCollection('users', [user as unknown as Record<string, unknown>]);

  res.json({ card });
});

apiRouter.patch('/srs/:id', async (req, res) => {
  const db = store.getState();
  const card = db.user_srs_cards.find((c) => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'SRS card not found' });

  if (typeof req.body?.personal_note === 'string') {
    card.personal_note = req.body.personal_note;
  }
  await store.saveCollection('user_srs_cards', [card as unknown as Record<string, unknown>]);
  res.json({ card });
});

apiRouter.delete('/srs/:id', async (req, res) => {
  const db = store.getState();
  const idx = db.user_srs_cards.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'SRS card not found' });
  const [removed] = db.user_srs_cards.splice(idx, 1);
  await store.deleteDoc('user_srs_cards', removed.id);
  res.json({ ok: true });
});

// 9. Practice Logs (Loop Listening timer etc.)
apiRouter.post('/practice-logs', async (req, res) => {
  const db = store.getState();
  const { activity_type, target_type, target_id, duration_seconds, score, detail_json } =
    req.body || {};

  const log: UserPracticeLog = {
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    user_id: DEFAULT_USER_ID,
    activity_type: activity_type || 'loop_listening',
    target_type: target_type || null,
    target_id: target_id || null,
    duration_seconds: Math.max(1, Number(duration_seconds || 60)),
    score: typeof score === 'number' ? score : null,
    detail_json: detail_json || {},
    created_at: new Date().toISOString(),
  };
  db.user_practice_logs.push(log);
  const user = touchUserActivity();

  await store.saveCollection('user_practice_logs', [log as unknown as Record<string, unknown>]);
  if (user) await store.saveCollection('users', [user as unknown as Record<string, unknown>]);

  res.status(201).json({ log });
});

// 10. Admin CMS & NotebookLM JSON Import
apiRouter.get('/admin/overview', (_req, res) => {
  const db = store.getState();
  const collections = Object.entries(db).map(([name, arr]) => ({
    name,
    count: Array.isArray(arr) ? arr.length : 0,
  }));
  res.json({
    backend: store.getBackendInfo(),
    sources: db.content_sources,
    collections,
  });
});

apiRouter.post('/admin/import', async (req, res) => {
  const db = store.getState();
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const imported: Record<string, number> = {};
  const allowedKeys = [
    'content_sources',
    'categories',
    'scenarios',
    'dialogues',
    'dialogue_turns',
    'sentence_patterns',
    'expression_groups',
    'expressions',
    'vocabulary',
    'dialogue_turn_vocabulary',
    'cultural_notes',
    'exercises',
    'listening_playlists',
    'playlist_items',
  ] as const;

  for (const key of allowedKeys) {
    const incoming = payload[key];
    if (!Array.isArray(incoming) || incoming.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetArr = db[key] as any[];
    const added: Record<string, unknown>[] = [];

    for (const item of incoming) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id;
      const existingIdx = id ? targetArr.findIndex((x) => x.id === id) : -1;
      if (existingIdx >= 0) {
        targetArr[existingIdx] = { ...targetArr[existingIdx], ...item };
      } else {
        targetArr.push(item);
      }
      added.push(item);
    }

    if (added.length > 0) {
      await store.saveCollection(key, added);
      imported[key] = added.length;
    }
  }

  res.json({ ok: true, imported });
});
