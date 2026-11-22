import { useEffect, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  Cloud,
  Database,
  Lock,
  LogIn,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ContentSource } from '../../../shared/types';

const USE_FIRESTORE_DIRECT = import.meta.env.VITE_USE_FIRESTORE_DIRECT === 'true';

const SAMPLE_IMPORT = JSON.stringify(
  {
    vocabulary: [
      {
        id: 'voc-demo-jetlag',
        word_en: 'jet lag',
        base_form: 'jet lag',
        ipa_us: '/ˈdʒet læɡ/',
        ipa_uk: '/ˈdʒet læɡ/',
        part_of_speech: 'n.',
        meaning_zh: '時差反應',
        locale_variant: 'BOTH',
        equivalent_word: null,
        example_en: "I'm still recovering from jet lag.",
        example_zh: '我還在調時差。',
        audio_url: null,
        difficulty_level: 'beginner',
      },
    ],
  },
  null,
  2
);

export function AdminPage() {
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const [overview, setOverview] = useState<{
    backend: { mode: 'firebase' | 'local'; projectId: string | null; note: string };
    sources: ContentSource[];
    collections: { name: string; count: number }[];
  } | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canImport = !USE_FIRESTORE_DIRECT || isAdmin;

  const load = () => api.getAdminOverview().then(setOverview);

  useEffect(() => {
    load();
  }, []);

  const handleImport = async () => {
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const res = await api.importAdminJson(parsed);
      setResult(`匯入成功！更新明細：${JSON.stringify(res.imported)}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!overview) {
    return <div className="p-12 text-center text-slate-500">載入後台資料中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">後台內容管理與 NotebookLM 匯入管線</h1>
        <p className="text-sm text-slate-500 mt-1">
          檢視 Firebase / 本機資料庫狀態、18 張資料表筆數、10 份 NotebookLM 教材溯源與安全性保護狀態
        </p>
      </div>

      {/* Backend Mode & Security Card */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              overview.backend.mode === 'firebase'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            {overview.backend.mode === 'firebase' ? (
              <Cloud className="w-5 h-5" />
            ) : (
              <Database className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
              <span>
                資料儲存模式：
                {overview.backend.mode === 'firebase'
                  ? `Firebase Firestore (${overview.backend.projectId || 'default'})`
                  : '本機 JSON 模式（Firebase Ready）'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" /> 唯讀保護已啟用
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{overview.backend.note}</p>
          </div>
        </div>
        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shrink-0">
          npm run seed:firebase
        </span>
      </section>

      {/* 18 Collections Summary */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-extrabold text-slate-900 text-sm">18 張核心資料表 / Firestore 集合統計</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {overview.collections.map((c) => (
            <div
              key={c.name}
              className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center"
            >
              <div className="text-lg font-extrabold text-indigo-700">{c.count}</div>
              <div className="text-[11px] font-mono text-slate-500 truncate" title={c.name}>
                {c.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NotebookLM JSON Batch Importer (Protected) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              {canImport ? (
                <Upload className="w-4 h-4 text-indigo-600" />
              ) : (
                <Lock className="w-4 h-4 text-amber-600" />
              )}
              NotebookLM 結構化 JSON 批次匯入
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {canImport
                ? '貼上符合 18 表格式的 JSON 教材包即可即時寫入資料庫（支援 Upsert）'
                : '公開網站已啟用 Firestore 寫入防護，僅管理員帳號或本機後端可執行教材匯入'}
            </p>
          </div>
          {canImport && (
            <button
              onClick={() => setJsonInput(SAMPLE_IMPORT)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
            >
              載入範例 JSON
            </button>
          )}
        </div>

        {canImport ? (
          <>
            <textarea
              rows={7}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"scenarios": [...], "dialogues": [...], "vocabulary": [...]}'
              className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {result && (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {result}
              </div>
            )}
            {error && (
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                匯入失敗：{error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleImport}
                disabled={!jsonInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold"
              >
                執行批次匯入
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">🔒 已鎖定公開寫入：</strong>
              {user
                ? '目前登入帳號為一般學員權限。若需於線上匯入教材，請以 Admin SDK 執行 scripts/set-admin-claim.mjs 授權，或於本機執行 npm run seed:firebase。'
                : '一般訪客僅可檢視教材統計；管理員請先透過 Google 登入並取得 admin 權限。'}
            </div>
            {!user && (
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" /> 管理員登入
              </button>
            )}
          </div>
        )}
      </section>

      {/* 10 NotebookLM Sources */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-indigo-600" />
          已登錄 NotebookLM 教材來源（{overview.sources.length} 份）
        </h2>
        <div className="divide-y divide-slate-100">
          {overview.sources.map((s) => (
            <div
              key={s.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <div className="font-bold text-sm text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.author_or_channel || '未標註作者'} · 類型：{s.source_type}
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                {s.notebooklm_source_id}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
