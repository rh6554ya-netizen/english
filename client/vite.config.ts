import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function listRelativeFiles(rootDir: string, subDir: string, filterExt?: string[]): string[] {
  const targetDir = path.join(rootDir, subDir);
  if (!fs.existsSync(targetDir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    const rel = path.posix.join(subDir.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) {
      results.push(...listRelativeFiles(rootDir, rel, filterExt));
    } else if (!filterExt || filterExt.some((ext) => entry.name.endsWith(ext))) {
      results.push(`./${rel}`);
    }
  }
  return results.sort();
}

function echoSpeakPwaPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'echospeak-pwa-sw',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const shellAssets = [
        './',
        './index.html',
        './manifest.webmanifest',
        ...listRelativeFiles(outDir, 'icons', ['.png', '.svg']),
        ...listRelativeFiles(outDir, 'assets', ['.js', '.css']),
      ];

      // Auto-precache all survival emergency MP3s (~0.8 MB) so offline SOS cards work immediately
      const survivalAudio = listRelativeFiles(outDir, 'audio/survival', ['.mp3']);

      const versionHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ shellAssets, survivalAudio }))
        .digest('hex')
        .slice(0, 10);

      let swCode = fs.readFileSync(swPath, 'utf8');
      swCode = swCode.replace('__ECHOSPEAK_CACHE_VERSION__', versionHash);
      swCode = swCode.replace(
        "/*__ECHOSPEAK_SHELL_ASSETS__*/ ['./', './index.html', './manifest.webmanifest']",
        JSON.stringify(shellAssets, null, 2)
      );
      swCode = swCode.replace(
        '/*__ECHOSPEAK_SURVIVAL_AUDIO__*/ []',
        JSON.stringify(survivalAudio, null, 2)
      );

      fs.writeFileSync(swPath, swCode, 'utf8');
      console.log(
        `[PWA] Built sw.js (v=${versionHash}): ${shellAssets.length} shell assets + ${survivalAudio.length} survival MP3s precached.`
      );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), echoSpeakPwaPlugin()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
