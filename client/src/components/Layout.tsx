import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Headphones,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogIn,
  LogOut,
  RefreshCw,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  User,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { usePwa } from '../lib/pwa';

const NAV_ITEMS = [
  { to: '/', label: '學習總覽', icon: LayoutDashboard, end: true },
  { to: '/ai-roleplay', label: 'AI 口說實戰', icon: Bot },
  { to: '/scenarios', label: '情境課程館', icon: BookOpen },
  { to: '/loop-player', label: '磨耳朵播放', icon: Headphones },
  { to: '/quick-drill', label: '3秒反應訓練', icon: Zap },
  { to: '/patterns', label: '句型與美式升級', icon: Sparkles },
  { to: '/survival', label: '隨身急救卡', icon: LifeBuoy },
  { to: '/challenges', label: '7天衝刺＆成就', icon: Trophy },
  { to: '/srs', label: 'SRS 複習庫', icon: Layers },
  { to: '/admin', label: '內容後台 CMS', icon: Database },
];

export function Layout() {
  const {
    user,
    loading,
    isAdmin,
    isFirebaseEnabled,
    authError,
    clearAuthError,
    signInWithGoogle,
    signOutUser,
  } = useAuth();

  const {
    isOnline,
    isStandalone,
    canInstall,
    isIosSafari,
    updateAvailable,
    promptInstall,
    applyUpdate,
  } = usePwa();

  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  const authKey = user ? `uid-${user.uid}-${isAdmin ? 'admin' : 'user'}` : 'guest';
  const showInstallBtn = canInstall || isIosSafari;

  const handleInstallClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (isIosSafari) {
      setIosGuideOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
              E
            </div>
            <div>
              <div className="font-extrabold text-slate-900 tracking-tight leading-none">
                EchoSpeak
              </div>
              <div className="text-[11px] text-slate-500 mt-1">美式英文對話實戰教室</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* PWA Install Prompt (Desktop / Tablet) */}
        {showInstallBtn && (
          <div className="px-3 mb-2">
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5" /> 安裝離線 App 到桌面
            </button>
          </div>
        )}
        {isStandalone && (
          <div className="px-4 mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> 已安裝為離線 App
          </div>
        )}

        {/* Auth & Sync Card */}
        <div className="p-3 m-3 mt-0 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          {user ? (
            <>
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user.displayName || '已登入學員'}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    {isAdmin ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> 管理員・雲端同步
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3 h-3" /> 個人進度雲端同步中
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={signOutUser}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> 登出帳號
              </button>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                訪客本機模式
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                可免費暢學所有教材；登入 Google 可跨裝置雲端同步學習進度與 SRS 卡片。
              </p>
              {isFirebaseEnabled && (
                <button
                  onClick={signInWithGoogle}
                  disabled={!isOnline}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" /> {isOnline ? 'Google 登入同步' : '離線暫停登入'}
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-extrabold">
              E
            </div>
            <span className="font-extrabold text-slate-900">EchoSpeak</span>
          </div>

          <div className="flex items-center gap-1.5">
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold"
                title="安裝離線 App"
              >
                <Smartphone className="w-3.5 h-3.5" /> 安裝
              </button>
            )}

            {user ? (
              <button
                onClick={signOutUser}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                title="點擊登出"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span className="max-w-[80px] truncate">{user.displayName || '已登入'}</span>
                <LogOut className="w-3 h-3 opacity-70" />
              </button>
            ) : isFirebaseEnabled ? (
              <button
                onClick={signInWithGoogle}
                disabled={!isOnline}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-600 disabled:bg-slate-300 text-white font-bold"
              >
                <LogIn className="w-3.5 h-3.5" /> 登入
              </button>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                EchoSpeak
              </span>
            )}
          </div>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto no-scrollbar mt-3 pb-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-5 p-3.5 rounded-xl bg-slate-900 text-white text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>離線模式運作中</strong> — 隨身急救卡、全站文字教材與已下載 MP3 皆可正常使用；連線後將自動同步進度。
                </span>
              </div>
              <NavLink
                to="/survival"
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0"
              >
                開啟急救卡
              </NavLink>
            </div>
          )}

          {/* SW Update Banner */}
          {updateAvailable && (
            <div className="mb-5 p-3.5 rounded-xl bg-indigo-600 text-white text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2 font-semibold">
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>EchoSpeak 有新版本可用，更新後可享有最新教材與離線體驗。</span>
              </div>
              <button
                onClick={applyUpdate}
                className="px-3 py-1.5 rounded-lg bg-white text-indigo-700 font-extrabold hover:bg-indigo-50 shrink-0 transition"
              >
                立即更新
              </button>
            </div>
          )}

          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-3">
              <span>⚠️ {authError}</span>
              <button
                onClick={clearAuthError}
                className="text-amber-700 hover:text-amber-900 shrink-0"
                aria-label="關閉提示"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">驗證登入狀態中...</div>
          ) : (
            <Outlet key={authKey} />
          )}
        </div>
      </main>

      {/* iOS Safari Add to Home Screen Guide Modal */}
      {iosGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-lg">
                  E
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">加入主畫面，變成離線 App</h3>
                  <p className="text-xs text-slate-500">iPhone / iPad Safari 安裝步驟</p>
                </div>
              </div>
              <button
                onClick={() => setIosGuideOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="關閉視窗"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  點擊 Safari 下方工具列的 <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-indigo-600" /> 分享</strong> 按鈕。
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  往下滑並點選 <strong>「加入主畫面（Add to Home Screen）」</strong>。
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  點選右上角 <strong>「新增」</strong>，即可在桌面像原生 App 一樣全螢幕開啟，出國無網路也能播急救語音！
                </span>
              </li>
            </ol>

            <button
              onClick={() => setIosGuideOpen(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
