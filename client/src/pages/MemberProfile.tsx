import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Briefcase, Activity } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Avatar } from '../components/Avatar';
import { InlineLoader } from '../components/Loading';
import { formatDate, formatRelative } from '../lib/utils';

const roleColors: Record<string, string> = {
  admin: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  finance: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  operations: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  support: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  developer: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = trpc.users.getById.useQuery({ id: id! });
  const { data: tasks } = trpc.tasks.list.useQuery({ assignedTo: id });

  if (isLoading) return <InlineLoader />;
  if (!user) return <div className="text-center text-ink-400">User not found</div>;

  const activeTasks = tasks?.filter((t) => t.status !== 'done') ?? [];

  return (
    <div className="space-y-6">
      <Link to="/directory" className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300">
        <ArrowLeft className="h-4 w-4" /> Back to Directory
      </Link>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={user.name} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user.name}</h1>
            {user.title && <p className="text-ink-500">{user.title}</p>}
            <div className="mt-2 flex items-center gap-2">
              <span className={`badge text-xs ${roleColors[user.role]}`}>{user.role}</span>
              {user.isActive && (
                <span className="badge bg-green-100 text-green-700 text-xs dark:bg-green-950 dark:text-green-300">
                  Active
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{user.activeTaskCount}</p>
            <p className="text-xs text-ink-500">Active tasks</p>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-ink-100 pt-6 dark:border-ink-800 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-ink-400" />
            <span>{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-ink-400" />
              <span>{user.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-ink-400" />
            <span>Joined {formatDate(user.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-ink-400" />
            <span>Last active {formatRelative(user.lastActiveAt)}</span>
          </div>
        </div>
      </div>

      {/* Assigned tasks */}
      <div className="card">
        <div className="border-b border-ink-200 px-5 py-3 dark:border-ink-800">
          <h2 className="font-semibold">Current Workload ({activeTasks.length})</h2>
        </div>
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          {activeTasks.length > 0 ? (
            activeTasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50"
              >
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-ink-400">
                    Due {formatDate(task.dueDate)}
                  </p>
                </div>
                <span className="badge bg-ink-100 text-ink-600 text-xs capitalize dark:bg-ink-800 dark:text-ink-300">
                  {task.status.replace('_', ' ')}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-ink-400">
              No active tasks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
