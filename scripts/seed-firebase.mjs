import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const requireFromServer = createRequire(path.join(SERVER_DIR, 'package.json'));
const dotenv = requireFromServer('dotenv');
const admin = requireFromServer('firebase-admin');

dotenv.config({ path: path.join(SERVER_DIR, '.env') });

const SEED_PATH = path.join(ROOT, 'data', 'seed-notebooklm.json');
const BATCH_LIMIT = 400;

function resolveCredentialFile(rawPath) {
  const trimmed = rawPath.trim();
  const candidates = path.isAbsolute(trimmed)
    ? [trimmed]
    : [path.resolve(SERVER_DIR, trimmed), path.resolve(ROOT, trimmed), path.resolve(trimmed)];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`找不到 GOOGLE_APPLICATION_CREDENTIALS 指定的檔案：${trimmed}`);
  }
  return found;
}

function initFirebase() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = process.env.FIREBASE_PROJECT_ID || cred.project_id;
    admin.initializeApp({ credential: admin.credential.cert(cred), projectId });
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    return { db, projectId };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    const credPath = resolveCredentialFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const projectId = process.env.FIREBASE_PROJECT_ID || cred.project_id;
    admin.initializeApp({ credential: admin.credential.cert(cred), projectId });
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    return { db, projectId };
  }
  throw new Error(
    '找不到 Firebase 憑證。請於 server/.env 設定 GOOGLE_APPLICATION_CREDENTIALS 或 FIREBASE_SERVICE_ACCOUNT_JSON。'
  );
}

async function main() {
  const { db, projectId } = initFirebase();
  console.log(`[Firebase Seed] Connected to project: ${projectId ?? 'default'}`);
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const collections = Object.keys(seed);

  let totalDocs = 0;
  for (const col of collections) {
    const items = seed[col];
    if (!Array.isArray(items) || items.length === 0) continue;

    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
      const chunk = items.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const item of chunk) {
        const docId =
          item.id ||
          (item.dialogue_turn_id && item.vocabulary_id
            ? `${item.dialogue_turn_id}__${item.vocabulary_id}`
            : undefined);
        const ref = docId ? db.collection(col).doc(String(docId)) : db.collection(col).doc();
        batch.set(ref, item, { merge: true });
      }
      await batch.commit();
    }
    totalDocs += items.length;
    console.log(`[Firebase Seed] ${col}: uploaded ${items.length} docs`);
  }

  console.log(`✅ All ${collections.length} collections (${totalDocs} docs) seeded to Firebase Firestore!`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
