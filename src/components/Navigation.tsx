import { Home, ListChecks, Bookmark, User, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn, hapticFeedback } from './UI';

export function BottomNav({ onOpenAdd }: { onOpenAdd: () => void }) {
  const items = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: ListChecks, label: 'Visto', path: '/seen' },
    { icon: Plus, label: 'Add', path: '#', action: onOpenAdd, primary: true },
    { icon: Bookmark, label: 'Pendiente', path: '/to-watch' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/60 backdrop-blur-xl border border-white/5 px-4 py-3 rounded-2xl flex items-center gap-2 z-50 shadow-2xl">
      {items.map((item, i) => (
        item.primary ? (
          <button
            key={i}
            onClick={() => {
              hapticFeedback();
              item.action?.();
            }}
            className="w-12 h-12 rounded-xl bg-accent text-accent-dark flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-[0_0_20px_rgba(0,245,255,0.3)]"
          >
            <item.icon size={24} strokeWidth={2.5} />
          </button>
        ) : (
          <NavLink
            key={i}
            to={item.path}
            onClick={() => hapticFeedback()}
            className={({ isActive }) => cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              isActive ? "bg-white/10 text-accent" : "text-zinc-500 hover:text-white"
            )}
          >
            <item.icon size={22} />
          </NavLink>
        )
      ))}
    </nav>
  );
}

export function Layout({ children, onOpenAdd }: any) {
  return (
    <div className="min-h-screen bg-surface-bg text-zinc-100 pb-32 relative overflow-hidden">
      <div className="absolute inset-0 accent-glow pointer-events-none" />
      <main className="max-w-xl mx-auto pt-8 px-4 relative z-10 w-full min-h-screen">
        {children}
      </main>
      <BottomNav onOpenAdd={onOpenAdd} />
    </div>
  );
}
