import type { RoleplayContextPayload, RoleplayHistoryItem } from './types';

function levelGuidance(level: RoleplayContextPayload['difficulty_level']): string {
  switch (level) {
    case 'zero_basis':
      return 'Learner is Zero-Basis (A1): Keep your English replies short (1-2 simple sentences), warm, clear, and avoid obscure slang. Still sound like a friendly native American speaker.';
    case 'intermediate':
      return 'Learner is Intermediate (B1-B2): Speak like a natural American native using casual contractions, softening/hedging ("kind of", "I was wondering if", "feel free to"), and realistic follow-up questions (2-3 sentences).';
    default:
      return 'Learner is Beginner (A2): Speak natural everyday American English in 1-2 clear sentences. Introduce useful high-frequency travel/daily phrases naturally.';
  }
}

export function buildStartPrompt(ctx: RoleplayContextPayload): {
  systemInstruction: string;
  userPrompt: string;
} {
  const missionsText = ctx.missions.map((m, i) => `${i + 1}. ${m}`).join('\n');

  const systemInstruction = `You are an interactive American English speaking tutor playing a realistic character in a roleplay for a Taiwanese learner.
Output ONLY valid JSON matching the exact requested schema. All Chinese explanations/translations MUST use Traditional Chinese (繁體中文, Taiwan usage).`;

  const userPrompt = `Start a live English roleplay conversation.

Scenario: ${ctx.scenario_title_en} (${ctx.scenario_title_zh})
Setting: ${ctx.setting_background}
Your Role: ${ctx.ai_role}
Your Persona: ${ctx.ai_persona}
Learner's Role: ${ctx.user_role}
Level Rule: ${levelGuidance(ctx.difficulty_level)}
Learner Missions:
${missionsText}

Return JSON with this exact shape:
{
  "ai_reply_en": "Your natural in-character opening line in American English",
  "ai_reply_zh": "Natural Traditional Chinese translation of your opening line",
  "rescue_hints": [
    { "en": "Very simple safe reply for the learner", "zh": "繁體中文翻譯", "tone": "simple" },
    { "en": "Natural everyday American reply", "zh": "繁體中文翻譯", "tone": "natural" },
    { "en": "Polite softened/upgraded American reply", "zh": "繁體中文翻譯", "tone": "polite" }
  ]
}`;

  return { systemInstruction, userPrompt };
}

export function buildTurnPrompt(
  ctx: RoleplayContextPayload,
  history: RoleplayHistoryItem[],
  userText: string,
  audioMeta?: { avgLogprob: number | null; durationSec: number | null } | null
): { systemInstruction: string; userPrompt: string } {
  const missionsText = ctx.missions.map((m, i) => `[${i}] ${m}`).join('\n');
  const historyText = history
    .slice(-16)
    .map((m) => `${m.role === 'ai' ? ctx.ai_role : ctx.user_role}: ${m.text_en}`)
    .join('\n');

  const hasAudio = Boolean(audioMeta);
  const systemInstruction = `You are both:
1) An in-character American English roleplay partner (${ctx.ai_role}), AND
2) A supportive Taiwanese-friendly American English speaking coach.

Important coaching philosophy (EchoSpeak style):
- Teach natural American conversational English (hedging/softening like "I was wondering if...", "Could I possibly...", "kind of", "sounds good to me", avoiding stiff textbook phrasing).
- If spoken via audio (transcribed by Whisper), keep "transcript" accurate to what the learner said, and give one brief practical pronunciation/linking/intonation tip in "pronunciation_tip_zh" tailored to the exact words they spoke. If text only, set "pronunciation_tip_zh" to null.
- Keep grammar_correction null if the learner's English is already grammatically fine; only point out meaningful errors.
- Always provide "native_upgrade_en": how a native American speaker would say the same idea even more naturally.
- Return ONLY valid JSON. All Chinese text MUST be Traditional Chinese (繁體中文).`;

  const learnerInputDesc = hasAudio
    ? `The learner spoke aloud (Whisper STT transcript): "${userText}"${
        audioMeta?.avgLogprob !== null && audioMeta?.avgLogprob !== undefined
          ? ` (Acoustic clarity logprob: ${audioMeta.avgLogprob}, closer to 0 means clearer speech)`
          : ''
      }`
    : `The learner's latest turn (typed text): "${userText}"`;

  const userPrompt = `Scenario: ${ctx.scenario_title_en} (${ctx.scenario_title_zh})
Setting: ${ctx.setting_background}
Your Role: ${ctx.ai_role} (${ctx.ai_persona})
Learner's Role: ${ctx.user_role}
Level Rule: ${levelGuidance(ctx.difficulty_level)}

Learner Missions (0-based index):
${missionsText}

Conversation so far:
${historyText || '(Opening turn)'}

${learnerInputDesc}

Return ONLY valid JSON with this exact shape:
{
  "transcript": "${userText.replace(/"/g, '\\"')}",
  "ai_reply_en": "Your natural in-character American English reply advancing the scenario.",
  "ai_reply_zh": "繁體中文翻譯",
  "turn_feedback": {
    "naturalness_score": 82,
    "grammar_correction": "Corrected sentence or null if grammar is already solid",
    "native_upgrade_en": "More natural American way to say what the learner meant",
    "native_upgrade_reason_zh": "簡潔說明為什麼這樣說更道地（1-2句繁體中文）",
    "pronunciation_tip_zh": ${hasAudio ? '"針對這句口說的發音/連音/重音小建議（1句繁體中文）"' : 'null'}
  },
  "completed_mission_indices": [0],
  "rescue_hints": [
    { "en": "Simple next reply", "zh": "繁體中文翻譯", "tone": "simple" },
    { "en": "Natural American next reply", "zh": "繁體中文翻譯", "tone": "natural" },
    { "en": "Polite upgraded next reply", "zh": "繁體中文翻譯", "tone": "polite" }
  ],
  "should_wrap_up": false
}

Notes:
- "completed_mission_indices" must list ALL 0-based mission indices achieved across the entire conversation so far (including earlier turns).
- Set "should_wrap_up" to true only if all missions are accomplished and the conversation reached a natural closing.`;

  return { systemInstruction, userPrompt };
}

export function buildEvaluatePrompt(
  ctx: RoleplayContextPayload,
  messages: { role: 'ai' | 'user'; text_en: string; used_audio?: boolean }[]
): { systemInstruction: string; userPrompt: string } {
  const missionsText = ctx.missions.map((m, i) => `${i + 1}. ${m}`).join('\n');
  const transcript = messages
    .map((m, idx) => `#${idx + 1} ${m.role === 'ai' ? ctx.ai_role : ctx.user_role}: ${m.text_en}`)
    .join('\n');
  const hasAnyAudio = messages.some((m) => m.role === 'user' && m.used_audio);

  const systemInstruction = `You are a senior American English speaking coach evaluating a Taiwanese learner's completed roleplay session.
Be encouraging, concrete, and focused on real-life American phrasing. Output ONLY valid JSON in Traditional Chinese (繁體中文) for all Chinese fields.`;

  const userPrompt = `Evaluate this completed roleplay conversation.

Scenario: ${ctx.scenario_title_en} (${ctx.scenario_title_zh})
Difficulty: ${ctx.difficulty_level}
Missions:
${missionsText}

Full Transcript:
${transcript}

Return ONLY valid JSON with this exact shape:
{
  "overall_score": 84,
  "naturalness_score": 82,
  "grammar_score": 85,
  "task_completion_score": 90,
  "pronunciation_score": ${hasAnyAudio ? '80' : 'null'},
  "summary_zh": "2-3句鼓勵且具體的總評",
  "strengths_zh": ["做得很好的地方1", "做得很好的地方2"],
  "focus_areas_zh": ["下次可以特別加強的具體建議1", "建議2"],
  "upgrade_cards": [
    {
      "user_said": "學員實際說過的句子",
      "native_en": "更像美國人的道地說法",
      "meaning_zh": "繁體中文意思",
      "nuance_note_zh": "簡短語氣/用法拆解（適合直接收進 SRS 複習卡）"
    }
  ]
}

Provide 2 to 4 high-value upgrade_cards drawn from the learner's actual turns (or key missing scenario expressions if the session was very short).`;

  return { systemInstruction, userPrompt };
}

export function buildPronunciationPrompt(
  targetTextEn: string,
  heardText: string,
  acousticMeta: { avgLogprob: number | null; noSpeechProb: number | null; durationSec: number | null },
  scenarioTitle?: string
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = `You are a friendly American English pronunciation & shadowing coach helping a Taiwanese learner practice shadowing.
Compare the Whisper speech-to-text transcript (what was actually recognized from the learner's voice) and acoustic clarity score against the target English sentence.
Evaluate word accuracy, fluency/pacing, likely intonation & Taiwanese learner stress pitfalls, and American linking/reductions.
Output ONLY valid JSON. All Chinese text MUST use Traditional Chinese (繁體中文).`;

  const userPrompt = `Target Sentence: "${targetTextEn}"
Whisper Recognized Speech ("heard_text"): "${heardText || '(silence / unintelligible)'}"
Acoustic Metrics: avg_logprob=${acousticMeta.avgLogprob ?? 'unknown'} (near -0.1 to -0.35 is very clear; below -0.7 indicates unclear/mumbled speech), no_speech_prob=${acousticMeta.noSpeechProb ?? 'unknown'}, duration_sec=${acousticMeta.durationSec ?? 'unknown'}
${scenarioTitle ? `Scenario Context: ${scenarioTitle}` : ''}

Return ONLY valid JSON matching this exact shape:
{
  "overall_score": 85,
  "accuracy_score": 86,
  "fluency_score": 82,
  "intonation_score": 84,
  "heard_text": "${heardText.replace(/"/g, '\\"')}",
  "word_feedback": [
    { "word": "Could", "status": "good", "ipa": null, "tip_zh": null },
    { "word": "aisle", "status": "watch", "ipa": "/aɪl/", "tip_zh": "s 不發音，唸起來像 I'll" }
  ],
  "linking_tips_zh": [
    "美式連音/弱讀實戰建議（例：Could I 常連讀成 Cou-dai，語調更順暢）"
  ],
  "encouragement_zh": "1-2句溫暖且具體的進步鼓勵"
}

Rules:
- Include EVERY word from the Target Sentence in order inside "word_feedback".
- If a word in Target Sentence matches heard_text accurately and acoustic clarity is good, mark "good". If it was slightly altered, tricky for Taiwanese speakers, or acoustic clarity is moderate, mark "watch" with IPA + concise tip_zh (under 25 Chinese chars). If skipped or misheard completely, mark "missed" with IPA + tip_zh.
- If heard_text is empty or unintelligible, give low scores (20-40) and gently remind the learner to speak closer to the microphone.
- Give 1-3 practical linking_tips_zh tailored to this exact sentence.`;

  return { systemInstruction, userPrompt };
}
