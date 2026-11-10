import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  PackageCheck,
  AlertTriangle,
  CheckSquare,
  KanbanSquare,
  Megaphone,
  ArrowRight,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useStore } from '../lib/store';
import { Avatar } from '../components/Avatar';
import { InlineLoader } from '../components/Loading';
import { formatDate, isOverdue, formatRelative } from '../lib/utils';
import type { TaskStatus, TaskPriority } from '../../../shared/types';

const statusColors: Record<TaskStatus, string> = {
  todo: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
};

const priorityColors: Record<TaskPriority, string> = {
  low: 'border-l-ink-300',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

export default function Dashboard() {
  const { user } = useStore();
  const { data, isLoading } = trpc.dashboard.get.useQuery();

  if (isLoading || !data) return <InlineLoader />;

  const stats = [
    { label: 'Active Orders', value: data.stats.activeOrders, icon: PackageCheck, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
    { label: 'Pending KYC', value: data.stats.pendingKyc, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950' },
    { label: 'Open Shipments', value: data.stats.openShipments, icon: TrendingUp, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950' },
    { label: 'Blocked Items', value: data.stats.unresolvedTickets, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950' },
  ];

  const quickLinks = [
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/board', label: 'Operations', icon: KanbanSquare },
    { to: '/directory', label: 'Directory', icon: Users },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-ink-500">
          Here's what's happening across ETI & Partners today
        </p>
      </div>

      {/* Pinned Announcements */}
      {data.pinnedAnnouncements?.length > 0 && (
        <div className="space-y-2">
          {data.pinnedAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="flex items-start gap-3 rounded-lg border-l-4 border-brand-500 bg-brand-50 p-4 dark:bg-brand-950/30"
            >
              <Megaphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
              <div>
                <p className="font-medium text-brand-900 dark:text-brand-200">{ann.title}</p>
                <p className="mt-1 text-sm text-ink-600 dark:text-ink-400 line-clamp-2">{ann.body}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {ann.createdBy?.name} · {formatRelative(ann.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-ink-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* My Tasks */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3 dark:border-ink-800">
            <h2 className="font-semibold">My Tasks</h2>
            <Link to="/tasks" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.myTasks.length > 0 ? (
              data.myTasks.map((task) => {
                const status = task.status as TaskStatus;
                const priority = task.priority as TaskPriority;
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className={`flex items-center gap-3 border-l-4 px-5 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50 ${priorityColors[priority]}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`badge text-xs ${statusColors[status]}`}>
                          {statusLabels[status]}
                        </span>
                        <span className="text-xs text-ink-400">
                          Due {formatDate(task.dueDate)}
                        </span>
                        {isOverdue(task.dueDate) && status !== 'done' && (
                          <span className="badge bg-red-100 text-red-700 text-xs dark:bg-red-950 dark:text-red-300">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-400" />
                  </Link>
                );
              })
            ) : (
              <div className="px-5 py-8 text-center text-sm text-ink-400">
                No tasks assigned to you
              </div>
            )}
          </div>
        </div>

        {/* Quick Links & Recent Activity */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Quick Links</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex flex-col items-center gap-2 rounded-lg border border-ink-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-ink-700 dark:hover:bg-ink-800"
                >
                  <link.icon className="h-6 w-6 text-brand-600" />
                  <span className="text-xs font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="border-b border-ink-200 px-5 py-3 dark:border-ink-800">
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.map((activity) => (
                  <div key={activity.id} className="px-5 py-3">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-ink-400">
                      {formatRelative(activity.updatedAt)} · {statusLabels[activity.status as TaskStatus]}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-sm text-ink-400">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
