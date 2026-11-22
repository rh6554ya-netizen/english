import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Database,
  Headphones,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Sparkles,
  Zap,
} from 'lucide-react';

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

        <div className="p-4 m-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">NotebookLM 教材驅動</div>
          <p className="mt-1 leading-relaxed text-slate-500">
            收錄 10 份精選教材・Edge TTS 三軌音檔・SM-2 記憶排程
          </p>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-extrabold">
              E
            </div>
            <span className="font-extrabold text-slate-900">EchoSpeak</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
            Phase 1 MVP
          </span>
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}
