import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Avatar } from '../components/Avatar';
import { InlineLoader } from '../components/Loading';
import { formatRelative } from '../lib/utils';
import { useState } from 'react';

const roleColors: Record<string, string> = {
  admin: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  finance: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  operations: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  support: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  developer: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

export default function Directory() {
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const [search, setSearch] = useState('');

  const filtered = users?.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Directory</h1>
        <p className="text-sm text-ink-500">All team members at ETI & Partners</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-9"
          placeholder="Search by name, email, or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <InlineLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((user) => {
            const lastActive = user.lastActiveAt;
            const recentlyActive = lastActive
              ? new Date(lastActive).getTime() > Date.now() - 5 * 60 * 1000
              : false;
            return (
              <Link
                key={user.id}
                to={`/directory/${user.id}`}
                className="card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={user.name} size="lg" online={recentlyActive} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{user.name}</p>
                    {user.title && (
                      <p className="text-sm text-ink-500">{user.title}</p>
                    )}
                    <span className={`badge mt-1.5 text-xs ${roleColors[user.role]}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-ink-400">
                  <p className="truncate">{user.email}</p>
                  {user.phone && <p>{user.phone}</p>}
                  <p>
                    {recentlyActive ? (
                      <span className="text-green-600">● Online</span>
                    ) : (
                      <span>Active {formatRelative(user.lastActiveAt)}</span>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
