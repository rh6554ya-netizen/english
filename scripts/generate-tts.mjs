import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED_PATH = path.join(ROOT, 'data', 'seed-notebooklm.json');
const AUDIO_ROOT = path.join(ROOT, 'client', 'public', 'audio');

const VOICES = {
  enLeft: 'en-US-GuyNeural',
  enRight: 'en-US-AriaNeural',
  zh: 'zh-TW-HsiaoChenNeural',
};

const SURVIVAL_EXTRA = [
  { id: 'surv-1', text: 'I am here for tourism and will be staying for seven days.' },
  { id: 'surv-2', text: 'I have nothing to declare, only my personal belongings and carry-on baggage.' },
  { id: 'surv-3', text: 'I have a severe food allergy to nuts and seafood. Can you confirm these dishes are safe for me?' },
  { id: 'surv-4', text: 'My wallet and passport are missing. I need to report this and contact my embassy.' },
  { id: 'surv-5', text: "I'm not feeling well and have severe pain. Can you take me to a doctor?" },
  { id: 'surv-6', text: "Please call an ambulance immediately! It's a medical emergency." },
  { id: 'surv-7', text: "I need urgent police assistance; I've been robbed." },
  { id: 'surv-8', text: "Excuse me, I'm lost. Could you show me on the map how to get to the station?" },
  { id: 'surv-9', text: 'Can I try this on? Where is the fitting room?' },
  { id: 'surv-10', text: 'How much is this, and is there any discount?' },
  { id: 'surv-11', text: "Do you take credit cards, and can I return or exchange this if it doesn't fit?" },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function synthesizeToFile(text, outPath, voice, rate = '+0%') {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
    return 'skipped';
  }
  ensureDir(outPath);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate });
      await new Promise((resolve, reject) => {
        const chunks = [];
        audioStream.on('data', (chunk) => chunks.push(chunk));
        audioStream.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 200) return reject(new Error('Empty audio buffer'));
          fs.writeFileSync(outPath, buf);
          resolve();
        });
        audioStream.on('error', reject);
      });
      return 'generated';
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

async function runPool(tasks, concurrency = 4) {
  let done = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      try {
        const res = await synthesizeToFile(task.text, task.outPath, task.voice, task.rate);
        if (res === 'generated') generated++;
        else skipped++;
      } catch (err) {
        failed++;
        console.error(`[TTS ERROR] ${path.relative(AUDIO_ROOT, task.outPath)}: ${err.message}`);
      }
      done++;
      if (done % 20 === 0 || done === tasks.length) {
        console.log(`[TTS] ${done}/${tasks.length} (generated=${generated}, skipped=${skipped}, failed=${failed})`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { total: tasks.length, generated, skipped, failed };
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const tasks = [];

  // 1. Dialogue turns (normal EN, slow EN, zh-TW)
  for (const t of seed.dialogue_turns) {
    const voice = t.speaker_side === 'right' ? VOICES.enRight : VOICES.enLeft;
    tasks.push({ text: t.text_en, outPath: path.join(AUDIO_ROOT, 'turns', `${t.id}_normal.mp3`), voice, rate: '+0%' });
    tasks.push({ text: t.text_en, outPath: path.join(AUDIO_ROOT, 'turns', `${t.id}_slow.mp3`), voice, rate: '-25%' });
    tasks.push({ text: t.text_zh, outPath: path.join(AUDIO_ROOT, 'turns', `${t.id}_zh.mp3`), voice: VOICES.zh, rate: '+0%' });
  }

  // 2. Vocabulary
  for (const v of seed.vocabulary) {
    tasks.push({ text: v.word_en, outPath: path.join(AUDIO_ROOT, 'vocab', `${v.id}.mp3`), voice: VOICES.enRight, rate: '-5%' });
  }

  // 3. Sentence patterns (example normal & slow)
  for (const p of seed.sentence_patterns) {
    const voice = p.speaker_role === 'Shop Assistant' ? VOICES.enLeft : VOICES.enRight;
    tasks.push({ text: p.example_en, outPath: path.join(AUDIO_ROOT, 'patterns', `${p.id}_normal.mp3`), voice, rate: '+0%' });
    tasks.push({ text: p.example_en, outPath: path.join(AUDIO_ROOT, 'patterns', `${p.id}_slow.mp3`), voice, rate: '-25%' });
  }

  // 4. Expressions (normal & slow)
  for (const e of seed.expressions) {
    tasks.push({ text: e.native_en, outPath: path.join(AUDIO_ROOT, 'expressions', `${e.id}_normal.mp3`), voice: VOICES.enRight, rate: '+0%' });
    tasks.push({ text: e.native_en, outPath: path.join(AUDIO_ROOT, 'expressions', `${e.id}_slow.mp3`), voice: VOICES.enRight, rate: '-25%' });
  }

  // 5. 3-second Quick Q&A exercises
  for (const ex of seed.exercises.filter((x) => x.exercise_type === 'quick_response_3s')) {
    if (ex.prompt_en) {
      tasks.push({ text: ex.prompt_en, outPath: path.join(AUDIO_ROOT, 'qa', `${ex.id}_q.mp3`), voice: VOICES.enLeft, rate: '+0%' });
    }
    tasks.push({ text: ex.correct_answer, outPath: path.join(AUDIO_ROOT, 'qa', `${ex.id}_a_normal.mp3`), voice: VOICES.enRight, rate: '+0%' });
    tasks.push({ text: ex.correct_answer, outPath: path.join(AUDIO_ROOT, 'qa', `${ex.id}_a_slow.mp3`), voice: VOICES.enRight, rate: '-25%' });
    if (ex.correct_answer_zh) {
      tasks.push({ text: ex.correct_answer_zh, outPath: path.join(AUDIO_ROOT, 'qa', `${ex.id}_a_zh.mp3`), voice: VOICES.zh, rate: '+0%' });
    }
  }

  // 6. Pocket Survival cards
  for (const s of SURVIVAL_EXTRA) {
    tasks.push({ text: s.text, outPath: path.join(AUDIO_ROOT, 'survival', `${s.id}_normal.mp3`), voice: VOICES.enRight, rate: '+0%' });
    tasks.push({ text: s.text, outPath: path.join(AUDIO_ROOT, 'survival', `${s.id}_slow.mp3`), voice: VOICES.enRight, rate: '-25%' });
  }

  console.log(`Starting Edge TTS batch generation for ${tasks.length} audio tracks into client/public/audio/ ...`);
  const summary = await runPool(tasks, 4);
  console.log('Done:', summary);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
