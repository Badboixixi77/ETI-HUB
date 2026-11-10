import { useState } from 'react';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Avatar } from '../components/Avatar';
import { InlineLoader, Spinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { formatRelative } from '../lib/utils';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

export default function Announcements() {
  const utils = trpc.useUtils();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  const { data: announcements, isLoading } = trpc.announcements.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);

  const markRead = trpc.announcements.markRead.useMutation({
    onSuccess: () => utils.announcements.list.invalidate(),
  });

  const deleteAnn = trpc.announcements.delete.useMutation({
    onSuccess: () => {
      utils.announcements.list.invalidate();
      toast.success('Announcement deleted');
    },
  });

  const createAnn = trpc.announcements.create.useMutation({
    onSuccess: () => {
      utils.announcements.list.invalidate();
      toast.success('Announcement posted');
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-ink-500">Company-wide messages from leadership</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Post Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <InlineLoader />
      ) : announcements && announcements.length > 0 ? (
        <div className="space-y-4">
          {/* Pinned */}
          {announcements.filter((a) => a.isPinned).length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-500">
                <Pin className="h-4 w-4" /> Pinned
              </h2>
              {announcements.filter((a) => a.isPinned).map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  onRead={() => !ann.isRead && markRead.mutate({ id: ann.id })}
                  onDelete={isAdmin ? () => deleteAnn.mutate({ id: ann.id }) : undefined}
                  pinned
                />
              ))}
            </div>
          )}

          {/* Regular */}
          {announcements.filter((a) => !a.isPinned).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-500">All Announcements</h2>
              {announcements.filter((a) => !a.isPinned).map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  onRead={() => !ann.isRead && markRead.mutate({ id: ann.id })}
                  onDelete={isAdmin ? () => deleteAnn.mutate({ id: ann.id }) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card py-12 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-ink-300" />
          <p className="text-sm text-ink-400">No announcements yet</p>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Post Announcement" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createAnn.mutate({
              title: formData.get('title') as string,
              body: formData.get('body') as string,
              isPinned: formData.get('isPinned') === 'on',
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Title</label>
            <input name="title" className="input" required placeholder="Announcement title" autoFocus />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea name="body" className="input min-h-32" rows={5} required placeholder="Write your announcement..." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPinned" className="rounded" />
            Pin to dashboard
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createAnn.isPending}>
              {createAnn.isPending ? <Spinner /> : <Megaphone className="h-4 w-4" />} Post
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AnnouncementCard({ announcement: ann, onRead, onDelete, pinned = false }: {
  announcement: any;
  onRead: () => void;
  onDelete?: () => void;
  pinned?: boolean;
}) {
  return (
    <div
      className={cn(
        'card p-5',
        pinned && 'border-l-4 border-brand-500',
        !ann.isRead && 'ring-2 ring-brand-200 dark:ring-brand-800',
      )}
      onClick={onRead}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {pinned && <Pin className="h-4 w-4 text-brand-500" />}
            {!ann.isRead && <div className="h-2 w-2 rounded-full bg-brand-500" />}
            <h3 className="font-semibold">{ann.title}</h3>
          </div>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">{ann.body}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
            <Avatar name={ann.createdBy?.name || '?'} size="xs" />
            <span>{ann.createdBy?.name}</span>
            <span>·</span>
            <span>{formatRelative(ann.createdAt)}</span>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this announcement?')) onDelete();
            }}
            className="ml-3 text-ink-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
