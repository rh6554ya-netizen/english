import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const DIST_DIR = path.join(CLIENT_DIR, 'dist');

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();

const gitName = execFileSync('git', ['config', 'user.name'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();

const gitEmail = execFileSync('git', ['config', 'user.email'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();

console.log('[Pages] Building client for GitHub Pages (/english/)...');
run('npm', ['--prefix', 'client', 'run', 'build'], {
  cwd: ROOT,
  env: {
    ...process.env,
    VITE_BASE_PATH: '/english/',
    VITE_USE_FIRESTORE_DIRECT: 'true',
    VITE_USE_HASH_ROUTER: 'true',
  },
});

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echospeak-gh-pages-'));
try {
  fs.cpSync(DIST_DIR, tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.nojekyll'), '');

  run('git', ['init', '-b', 'gh-pages'], { cwd: tmpDir });
  run('git', ['config', 'user.name', gitName || 'EchoSpeak Deploy'], { cwd: tmpDir });
  run('git', ['config', 'user.email', gitEmail || 'deploy@echospeak.local'], { cwd: tmpDir });
  run('git', ['add', '-A'], { cwd: tmpDir });
  run('git', ['commit', '-m', 'chore: deploy EchoSpeak to GitHub Pages'], { cwd: tmpDir });
  run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: tmpDir });
  run('git', ['push', '--force', 'origin', 'gh-pages'], { cwd: tmpDir });

  console.log('✅ Pushed static bundle + 306 MP3s to branch gh-pages!');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
