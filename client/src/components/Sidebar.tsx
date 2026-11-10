import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  MessageSquare,
  KanbanSquare,
  FolderOpen,
  Calendar,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/board', icon: KanbanSquare, label: 'Operations' },
  { to: '/directory', icon: Users, label: 'Directory' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-ink-200 bg-white transition-all duration-200 dark:border-ink-800 dark:bg-ink-900 lg:relative',
          sidebarOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full lg:w-16 lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-ink-200 px-4 dark:border-ink-800">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-900 text-white font-bold">
            E
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-brand-900 dark:text-brand-200">ETI Hub</p>
              <p className="truncate text-xs text-ink-400">ETI & Partners</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (window.innerWidth < 1024) toggleSidebar();
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/20 dark:text-brand-200'
                    : 'text-ink-600 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-800',
                  !sidebarOpen && 'lg:justify-center',
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-ink-200 p-2 dark:border-ink-800">
          <button
            onClick={toggleSidebar}
            className="hidden w-full items-center justify-center gap-2 rounded-lg py-2 text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800 lg:flex"
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
