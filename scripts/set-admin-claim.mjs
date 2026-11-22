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

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error('用法：node scripts/set-admin-claim.mjs <user-email>');
  process.exit(1);
}

function resolveCredentialFile(rawPath) {
  const trimmed = rawPath.trim();
  const candidates = path.isAbsolute(trimmed)
    ? [trimmed]
    : [path.resolve(SERVER_DIR, trimmed), path.resolve(ROOT, trimmed), path.resolve(trimmed)];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`找不到憑證檔案：${trimmed}`);
  return found;
}

const cred = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : JSON.parse(fs.readFileSync(resolveCredentialFile(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(cred),
  projectId: process.env.FIREBASE_PROJECT_ID || cred.project_id,
});

async function main() {
  const user = await admin.auth().getUserByEmail(targetEmail);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  await admin.firestore().collection('users').doc(user.uid).set({ role: 'admin' }, { merge: true });
  console.log(`✅ 已授予管理員權限（admin: true）：${user.email} (uid=${user.uid})`);
  console.log('請在網頁上重新登入一次以更新 ID Token。');
}

main().catch((err) => {
  console.error('❌ 設定失敗：', err.message);
  process.exit(1);
});
