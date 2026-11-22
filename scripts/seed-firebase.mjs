import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, 'server', '.env') });

const SEED_PATH = path.join(ROOT, 'data', 'seed-notebooklm.json');

function initFirebase() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    return admin.firestore();
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return admin.firestore();
  }
  throw new Error(
    '找不到 Firebase 憑證。請於 server/.env 設定 GOOGLE_APPLICATION_CREDENTIALS 或 FIREBASE_SERVICE_ACCOUNT_JSON。'
  );
}

async function main() {
  const db = initFirebase();
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const collections = Object.keys(seed);

  for (const col of collections) {
    const items = seed[col];
    if (!Array.isArray(items) || items.length === 0) continue;

    const batch = db.batch();
    for (const item of items) {
      const docId =
        item.id ||
        (item.dialogue_turn_id && item.vocabulary_id
          ? `${item.dialogue_turn_id}__${item.vocabulary_id}`
          : undefined);
      const ref = docId ? db.collection(col).doc(String(docId)) : db.collection(col).doc();
      batch.set(ref, item, { merge: true });
    }
    await batch.commit();
    console.log(`[Firebase Seed] ${col}: uploaded ${items.length} docs`);
  }

  console.log('✅ All 18 collections seeded to Firebase Firestore!');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
