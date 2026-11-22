export type DifficultyLevel = 'zero_basis' | 'beginner' | 'intermediate';
export type TravelMode = 'general' | 'solo_travel' | 'group_tour';
export type DialogueType = 'mini_dialogue' | 'qa_pair' | 'roleplay_script' | 'story_animation';
export type RegisterTag = 'formal' | 'neutral' | 'informal' | 'slang' | 'sarcastic' | 'ironic' | 'mildly_vulgar';
export type NuanceType = 'hedging' | 'small_talk_bridge' | 'idiom' | 'filler' | 'softening';
export type LearningGoal = 'travel_solo' | 'travel_group' | 'daily_life' | 'small_talk';

export interface ContentSource {
  id: string;
  notebooklm_source_id: string | null;
  title: string;
  source_type: 'book' | 'youtube' | 'article' | 'custom';
  author_or_channel: string | null;
  url: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  slug: string;
  name_zh: string;
  name_en: string;
  icon: string;
  sort_order: number;
}

export interface Scenario {
  id: string;
  category_id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  difficulty_level: DifficultyLevel;
  travel_mode: TravelMode;
  story_background: string;
  cover_image_url: string | null;
  estimated_minutes: number;
  is_survival_essential: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface Dialogue {
  id: string;
  scenario_id: string;
  source_id: string | null;
  source_ref: string | null;
  dialogue_type: DialogueType;
  title_zh: string;
  title_en: string | null;
  context_note: string | null;
  illustration_url: string | null;
  full_audio_url: string | null;
  sort_order: number;
}

export interface DialogueTurn {
  id: string;
  dialogue_id: string;
  turn_order: number;
  speaker_role: string;
  speaker_side: 'left' | 'right';
  is_learner_role: boolean;
  text_en: string;
  text_en_alt_locale: string | null;
  text_zh: string;
  audio_normal_url: string | null;
  audio_slow_url: string | null;
  audio_zh_url: string | null;
  timestamp_start_sec: number | null;
  timestamp_end_sec: number | null;
  default_loop_count: number;
}

export interface PatternSlotChoice {
  en: string;
  zh: string;
  audio_url?: string | null;
}

export interface PatternSlot {
  key: string;
  label_zh: string;
  choices: PatternSlotChoice[];
}

export interface SentencePattern {
  id: string;
  scenario_id: string;
  source_id: string | null;
  speaker_role: string;
  formula_en: string;
  formula_zh: string;
  pragmatic_note: string | null;
  register: RegisterTag;
  slots_json: PatternSlot[];
  example_en: string;
  example_zh: string;
  audio_normal_url: string | null;
  audio_slow_url: string | null;
  is_survival_essential: boolean;
  survival_tag?: string | null;
}

export interface ExpressionGroup {
  id: string;
  scenario_id: string | null;
  source_id: string | null;
  topic_code: string | null;
  title_en: string;
  title_zh: string;
  group_type: 'synonym_spectrum' | 'native_upgrade';
  illustration_url: string | null;
}

export interface Expression {
  id: string;
  group_id: string;
  standard_en: string | null;
  native_en: string;
  meaning_zh: string;
  register_tag: RegisterTag;
  nuance_type: NuanceType | null;
  idiom_note: string | null;
  audio_normal_url: string | null;
  audio_slow_url: string | null;
  sort_order: number;
}

export interface Vocabulary {
  id: string;
  word_en: string;
  base_form: string | null;
  ipa_us: string | null;
  ipa_uk: string | null;
  part_of_speech: string | null;
  meaning_zh: string;
  locale_variant: 'US' | 'UK' | 'BOTH';
  equivalent_word: string | null;
  example_en: string | null;
  example_zh: string | null;
  audio_url: string | null;
  difficulty_level: DifficultyLevel;
}

export interface DialogueTurnVocabulary {
  dialogue_turn_id: string;
  vocabulary_id: string;
  highlight_text: string;
}

export interface CulturalNote {
  id: string;
  scenario_id: string;
  dialogue_id: string | null;
  note_type: 'culture' | 'etiquette' | 'conversation_hack' | 'grammar_tip' | 'travel_warning';
  title_zh: string;
  content_zh: string;
  sort_order: number;
}

export interface Exercise {
  id: string;
  scenario_id: string;
  dialogue_id: string | null;
  exercise_type: 'reverse_translation' | 'fill_in_blank' | 'listening_choice' | 'quick_response_3s' | 'sentence_reorder';
  prompt_text: string;
  prompt_audio_url: string | null;
  prompt_en?: string | null;
  situation_tag?: string | null;
  options_json: string[] | null;
  correct_answer: string;
  correct_answer_zh?: string | null;
  answer_audio_normal_url?: string | null;
  answer_audio_slow_url?: string | null;
  answer_audio_zh_url?: string | null;
  acceptable_answers_json: string[];
  explanation_zh: string | null;
  time_limit_sec: number | null;
  sort_order: number;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'learner' | 'admin';
  current_level: DifficultyLevel;
  learning_goal: LearningGoal;
  preferred_accent: 'US' | 'UK';
  daily_goal_minutes: number;
  streak_days: number;
  last_active_date: string | null;
  created_at: string;
}

export interface UserScenarioProgress {
  id: string;
  user_id: string;
  scenario_id: string;
  step1_blind_listen_done: boolean;
  step2_study_done: boolean;
  step3_shadowing_done: boolean;
  step4_quiz_best_score: number;
  completion_percent: number;
  last_studied_at: string;
}

export interface UserSrsCard {
  id: string;
  user_id: string;
  item_type: 'vocabulary' | 'sentence_pattern' | 'expression' | 'dialogue_turn' | 'exercise';
  item_id: string;
  front_zh: string;
  back_en: string;
  ipa?: string | null;
  audio_url?: string | null;
  personal_note: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
}

export interface UserPracticeLog {
  id: string;
  user_id: string;
  activity_type: 'loop_listening' | 'quick_3s' | 'shadowing' | 'quiz' | 'srs_review' | 'ai_roleplay';
  target_type: 'scenario' | 'dialogue' | 'playlist' | null;
  target_id: string | null;
  duration_seconds: number;
  score: number | null;
  detail_json: Record<string, unknown>;
  created_at: string;
}

export interface PlaybackStep {
  track: 'audio_normal_url' | 'audio_slow_url' | 'audio_zh_url';
  repeat: number;
  pause_ms: number;
}

export interface PlaybackRecipe {
  name_zh?: string;
  sequence: PlaybackStep[];
  loop_playlist: boolean;
}

export interface ListeningPlaylist {
  id: string;
  user_id: string | null;
  title_zh: string;
  description: string | null;
  is_system: boolean;
  playback_recipe_json: PlaybackRecipe;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  item_type: 'dialogue' | 'dialogue_turn' | 'sentence_pattern' | 'expression' | 'exercise';
  item_id: string;
  sort_order: number;
  is_system?: boolean;
  user_id?: string | null;
}

export interface DatabaseState {
  content_sources: ContentSource[];
  categories: Category[];
  scenarios: Scenario[];
  dialogues: Dialogue[];
  dialogue_turns: DialogueTurn[];
  sentence_patterns: SentencePattern[];
  expression_groups: ExpressionGroup[];
  expressions: Expression[];
  vocabulary: Vocabulary[];
  dialogue_turn_vocabulary: DialogueTurnVocabulary[];
  cultural_notes: CulturalNote[];
  exercises: Exercise[];
  users: UserProfile[];
  user_scenario_progress: UserScenarioProgress[];
  user_srs_cards: UserSrsCard[];
  user_practice_logs: UserPracticeLog[];
  listening_playlists: ListeningPlaylist[];
  playlist_items: PlaylistItem[];
}
