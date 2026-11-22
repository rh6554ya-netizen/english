import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import type { DatabaseState } from '../../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function resolveProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'data', 'seed-notebooklm.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(startDir, '../../..');
}
const ROOT = resolveProjectRoot(__dirname);
const SERVER_DIR = path.join(ROOT, 'server');
const SEED_PATH = path.join(ROOT, 'data', 'seed-notebooklm.json');
const RUNTIME_PATH = path.join(ROOT, 'data', 'runtime-db.json');
const BATCH_LIMIT = 400;

const COLLECTIONS: (keyof DatabaseState)[] = [
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
  'users',
  'user_scenario_progress',
  'user_srs_cards',
  'user_practice_logs',
  'listening_playlists',
  'playlist_items',
];

export interface BackendInfo {
  mode: 'firebase' | 'local';
  projectId: string | null;
  note: string;
}

class DataStore {
  private state: DatabaseState | null = null;
  private firestore: admin.firestore.Firestore | null = null;
  private mode: 'firebase' | 'local' = 'local';
  private projectId: string | null = null;

  private resolveCredentialFile(rawPath: string): string {
    const trimmed = rawPath.trim();
    const candidates = path.isAbsolute(trimmed)
      ? [trimmed]
      : [path.resolve(SERVER_DIR, trimmed), path.resolve(ROOT, trimmed), path.resolve(trimmed)];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      throw new Error(`找不到 GOOGLE_APPLICATION_CREDENTIALS 檔案：${trimmed}`);
    }
    return found;
  }

  async init(): Promise<void> {
    const hasServiceJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
    const hasCredPath = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());

    if (hasServiceJson || hasCredPath) {
      try {
        if (!admin.apps.length) {
          let cred: admin.ServiceAccount & { project_id?: string };
          if (hasServiceJson) {
            cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
          } else {
            const credPath = this.resolveCredentialFile(
              process.env.GOOGLE_APPLICATION_CREDENTIALS!
            );
            cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
          }
          const projectId = process.env.FIREBASE_PROJECT_ID || cred.project_id || undefined;
          admin.initializeApp({
            credential: admin.credential.cert(cred),
            projectId,
          });
          this.projectId = projectId || null;
        }
        this.firestore = admin.firestore();
        try {
          this.firestore.settings({ ignoreUndefinedProperties: true });
        } catch {
          // settings() may only be called once per Firestore instance
        }
        this.mode = 'firebase';
        await this.loadFromFirestoreOrSeed();
        console.log(`[DB] Connected to Firebase Firestore (project=${this.projectId ?? 'default'})`);
        return;
      } catch (err) {
        console.warn('[DB] Firebase init failed, falling back to local JSON store:', (err as Error).message);
      }
    }

    this.mode = 'local';
    this.loadLocal();
    console.log('[DB] Running with local JSON store (data/runtime-db.json). Set Firebase env vars in server/.env to enable Firestore.');
  }

  private loadSeed(): DatabaseState {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as DatabaseState;
  }

  private loadLocal(): void {
    if (fs.existsSync(RUNTIME_PATH)) {
      this.state = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8')) as DatabaseState;
    } else {
      this.state = this.loadSeed();
      this.persistLocal();
    }
  }

  private persistLocal(): void {
    if (!this.state) return;
    fs.mkdirSync(path.dirname(RUNTIME_PATH), { recursive: true });
    fs.writeFileSync(RUNTIME_PATH, JSON.stringify(this.state, null, 2), 'utf8');
  }

  private async commitDocs(col: string, docs: Record<string, unknown>[]): Promise<void> {
    if (!this.firestore || docs.length === 0) return;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = this.firestore.batch();
      for (const item of chunk) {
        const docId = this.getDocId(item);
        const ref = docId
          ? this.firestore.collection(col).doc(docId)
          : this.firestore.collection(col).doc();
        batch.set(ref, item, { merge: true });
      }
      await batch.commit();
    }
  }

  private async loadFromFirestoreOrSeed(): Promise<void> {
    if (!this.firestore) return;
    const seed = this.loadSeed();
    const state = {} as DatabaseState;

    const firstSnap = await this.firestore.collection('scenarios').limit(1).get();
    if (firstSnap.empty) {
      console.log('[DB] Firestore is empty; seeding all 18 collections from NotebookLM seed data...');
      for (const col of COLLECTIONS) {
        const items = seed[col] as unknown as Record<string, unknown>[];
        if (!items.length) continue;
        await this.commitDocs(col, items);
      }
      this.state = seed;
      return;
    }

    for (const col of COLLECTIONS) {
      const snap = await this.firestore.collection(col).get();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state as any)[col] = snap.empty ? seed[col] : snap.docs.map((d) => d.data());
    }
    this.state = state;
  }

  private getDocId(item: Record<string, unknown>): string | null {
    if (typeof item.id === 'string' && item.id) return item.id;
    if (typeof item.dialogue_turn_id === 'string' && typeof item.vocabulary_id === 'string') {
      return `${item.dialogue_turn_id}__${item.vocabulary_id}`;
    }
    return null;
  }

  getState(): DatabaseState {
    if (!this.state) {
      this.loadLocal();
    }
    return this.state!;
  }

  getBackendInfo(): BackendInfo {
    return {
      mode: this.mode,
      projectId: this.projectId,
      note:
        this.mode === 'firebase'
          ? '已連線至 Firebase Firestore（18 張集合即時同步）'
          : '目前使用本機 JSON 持久化（data/runtime-db.json）；於 server/.env 設定 Firebase 憑證後即可無縫切換至 Firestore',
    };
  }

  async saveCollection<K extends keyof DatabaseState>(col: K, changedDocs?: Record<string, unknown>[]): Promise<void> {
    if (this.mode === 'firebase' && this.firestore && changedDocs && changedDocs.length > 0) {
      await this.commitDocs(col, changedDocs);
    } else if (this.mode === 'local') {
      this.persistLocal();
    }
  }

  async deleteDoc<K extends keyof DatabaseState>(col: K, docId: string): Promise<void> {
    if (this.mode === 'firebase' && this.firestore) {
      await this.firestore.collection(col).doc(docId).delete();
    } else {
      this.persistLocal();
    }
  }
}

export const store = new DataStore();
