import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Cloud,
  Database,
  Headphones,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const NAV_ITEMS = [
  { to: '/', label: '學習總覽', icon: LayoutDashboard, end: true },
  { to: '/scenarios', label: '情境課程館', icon: BookOpen },
  { to: '/loop-player', label: '磨耳朵播放', icon: Headphones },
  { to: '/quick-drill', label: '3秒反應訓練', icon: Zap },
  { to: '/patterns', label: '句型與美式升級', icon: Sparkles },
  { to: '/survival', label: '隨身急救卡', icon: LifeBuoy },
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

  const authKey = user ? `uid-${user.uid}-${isAdmin ? 'admin' : 'user'}` : 'guest';

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

        {/* Auth & Sync Card */}
        <div className="p-3 m-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
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
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" /> Google 登入同步
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

          {user ? (
            <button
              onClick={signOutUser}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
              title="點擊登出"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="max-w-[90px] truncate">{user.displayName || '已登入'}</span>
              <LogOut className="w-3 h-3 opacity-70" />
            </button>
          ) : isFirebaseEnabled ? (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-600 text-white font-bold"
            >
              <LogIn className="w-3.5 h-3.5" /> Google 登入
            </button>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
              EchoSpeak
            </span>
          )}
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
    </div>
  );
}
