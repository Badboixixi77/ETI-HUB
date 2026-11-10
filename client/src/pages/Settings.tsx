import { useState } from 'react';
import { UserPlus, UserCog, Bell, Moon, Sun, KeyRound, Trash2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useStore } from '../lib/store';
import { Avatar } from '../components/Avatar';
import { InlineLoader, Spinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { cn } from '../lib/utils';
import type { Role } from '../../../shared/types';

type Tab = 'profile' | 'team' | 'notifications' | 'appearance';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'support', label: 'Support' },
  { value: 'developer', label: 'Developer' },
];

const roleColors: Record<Role, string> = {
  admin: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  finance: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  operations: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  support: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  developer: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

export default function Settings() {
  const { user } = useStore();
  const [tab, setTab] = useState<Tab>('profile');
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-ink-500">Manage your profile and team</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-800">
        {[
          { key: 'profile' as Tab, label: 'Profile', icon: UserCog },
          { key: 'notifications' as Tab, label: 'Notifications', icon: Bell },
          { key: 'appearance' as Tab, label: 'Appearance', icon: Moon },
          ...(isAdmin ? [{ key: 'team' as Tab, label: 'Team Management', icon: UserPlus }] : []),
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === key
                ? 'border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-200'
                : 'border-transparent text-ink-500 hover:text-ink-700 dark:hover:text-ink-300',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'team' && isAdmin && <TeamTab />}
    </div>
  );
}

function ProfileTab() {
  const { user, setUser } = useStore();
  const utils = trpc.useUtils();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: (updated) => {
      setUser(updated);
      utils.auth.me.invalidate();
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success('Password changed');
      setOldPassword('');
      setNewPassword('');
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="card max-w-2xl p-6">
        <h2 className="mb-4 font-semibold">Personal Information</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            updateProfile.mutate({
              name: formData.get('name') as string,
              title: (formData.get('title') as string) || null,
              phone: (formData.get('phone') as string) || null,
              avatarUrl: null,
            });
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-ink-500">{user.email}</p>
              <span className={`badge mt-1 text-xs ${roleColors[user.role]}`}>{user.role}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full name</label>
              <input name="name" className="input" defaultValue={user.name} required />
            </div>
            <div>
              <label className="label">Title</label>
              <input name="title" className="input" defaultValue={user.title ?? ''} placeholder="e.g. Operations Lead" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={user.email} disabled />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="input" defaultValue={user.phone ?? ''} placeholder="+44..." />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? <Spinner /> : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card max-w-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4" /> Change Password
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 8) {
              toast.error('Password must be at least 8 characters');
              return;
            }
            changePassword.mutate({ currentPassword: oldPassword, newPassword });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Current password</label>
            <input type="password" className="input" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">New password (min 8 characters)</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? <Spinner /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.settings.getPreferences.useQuery();
  const updatePrefs = trpc.settings.updatePreferences.useMutation({
    onSuccess: () => {
      utils.settings.getPreferences.invalidate();
      toast.success('Preferences saved');
    },
  });

  if (isLoading) return <InlineLoader />;
  if (!prefs) return null;

  const toggles: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: 'emailOnTaskAssigned', label: 'Task assigned', desc: 'Get an email when a task is assigned to you' },
    { key: 'emailOnTaskUpdated', label: 'Task updated', desc: 'Get an email when your tasks are updated' },
    { key: 'emailOnMessage', label: 'New messages', desc: 'Get an email when you receive a direct message' },
    { key: 'emailOnAnnouncement', label: 'Announcements', desc: 'Get an email for new company announcements' },
  ];

  return (
    <div className="card max-w-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Bell className="h-4 w-4" /> Notification Preferences
      </h2>
      <div className="space-y-4">
        {toggles.map((toggle) => (
          <label
            key={toggle.key}
            className="flex items-center justify-between rounded-lg border border-ink-200 p-4 dark:border-ink-700"
          >
            <div>
              <p className="text-sm font-medium">{toggle.label}</p>
              <p className="text-xs text-ink-500">{toggle.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs[toggle.key]}
              onClick={() => updatePrefs.mutate({ [toggle.key]: !prefs[toggle.key] } as any)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
                prefs[toggle.key] ? 'bg-brand-900' : 'bg-ink-300',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  prefs[toggle.key] ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { darkMode, toggleDarkMode } = useStore();

  return (
    <div className="card max-w-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Moon className="h-4 w-4" /> Appearance
      </h2>
      <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4 dark:border-ink-700">
        <div>
          <p className="text-sm font-medium">Dark Mode</p>
          <p className="text-xs text-ink-500">Toggle between light and dark themes</p>
        </div>
        <button
          onClick={toggleDarkMode}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            darkMode ? 'bg-brand-900' : 'bg-ink-300',
          )}
        >
          <span
            className={cn(
              'inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white transition-transform',
              darkMode ? 'translate-x-6' : 'translate-x-1',
            )}
          >
            {darkMode ? <Moon className="h-2.5 w-2.5 text-brand-900" /> : <Sun className="h-2.5 w-2.5 text-ink-500" />}
          </span>
        </button>
      </div>
    </div>
  );
}

function TeamTab() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const [showInvite, setShowInvite] = useState(false);

  const invite = trpc.users.invite.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success('Team member added');
      setShowInvite(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success('User updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivate = trpc.users.deactivate.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success('User deactivated');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Team Members</h2>
        <button onClick={() => setShowInvite(true)} className="btn btn-primary">
          <UserPlus className="h-4 w-4" /> Add Member
        </button>
      </div>

      {isLoading ? (
        <InlineLoader />
      ) : (
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {users?.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3">
              <Avatar name={u.name} size="md" online={u.isActive} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-ink-400">{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => updateUser.mutate({ id: u.id, role: e.target.value as Role })}
                className="input w-auto py-1 text-sm"
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <span className={`badge text-xs ${roleColors[u.role]}`}>{u.role}</span>
              {u.isActive ? (
                <button
                  onClick={() => {
                    if (confirm(`Deactivate ${u.name}?`)) deactivate.mutate({ id: u.id });
                  }}
                  className="text-ink-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="badge bg-ink-100 text-ink-500 text-xs">Inactive</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Add Team Member" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            invite.mutate({
              email: formData.get('email') as string,
              name: formData.get('name') as string,
              role: formData.get('role') as Role,
              title: (formData.get('title') as string) || undefined,
              phone: (formData.get('phone') as string) || undefined,
              password: formData.get('password') as string,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full name</label>
              <input name="name" className="input" required autoFocus />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" required />
            </div>
            <div>
              <label className="label">Role</label>
              <select name="role" className="input" defaultValue="support">
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input name="title" className="input" placeholder="e.g. Operations" />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input name="phone" className="input" placeholder="+44..." />
            </div>
            <div>
              <label className="label">Temporary password (min 8 chars)</label>
              <input name="password" type="password" className="input" required minLength={8} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowInvite(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={invite.isPending}>
              {invite.isPending ? <Spinner /> : <UserPlus className="h-4 w-4" />} Add Member
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
