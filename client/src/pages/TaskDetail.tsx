import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Send, Clock, User, AlertTriangle } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Avatar } from '../components/Avatar';
import { InlineLoader, Spinner } from '../components/Loading';
import { toast } from '../components/Toast';
import { formatDate, isOverdue, formatRelative } from '../lib/utils';
import { cn } from '../lib/utils';
import type { TaskStatus, TaskPriority } from '../../../shared/types';

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState('');

  const utils = trpc.useUtils();
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: id! });
  const { data: users } = trpc.users.list.useQuery();

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: id! });
      utils.tasks.list.invalidate();
      toast.success('Task updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const addComment = trpc.tasks.addComment.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: id! });
      setNewComment('');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success('Task deleted');
      navigate('/tasks');
    },
  });

  if (isLoading) return <InlineLoader />;
  if (!task) return <div className="text-center text-ink-400">Task not found</div>;

  const status = task.status as TaskStatus;
  const priority = task.priority as TaskPriority;
  const canDelete = task.createdBy?.id === useStoreState().user?.id || useStoreState().user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/tasks" className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300">
          <ArrowLeft className="h-4 w-4" /> Back to Tasks
        </Link>
        {canDelete && (
          <button
            onClick={() => {
              if (confirm('Delete this task? This cannot be undone.')) {
                deleteTask.mutate({ id: id! });
              }
            }}
            className="btn btn-ghost text-red-600"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>

      {/* Task header */}
      <div className="card p-6">
        <h1 className="text-xl font-bold">{task.title}</h1>
        {task.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600 dark:text-ink-400">{task.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-ink-400" />
            <span className="text-ink-400">Created by</span>
            <span className="font-medium">{task.creator?.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-ink-400" />
            <span className="text-ink-400">Due</span>
            <span className={cn('font-medium', isOverdue(task.dueDate) && status !== 'done' && 'text-red-600')}>
              {formatDate(task.dueDate)}
            </span>
          </div>
          {isOverdue(task.dueDate) && status !== 'done' && (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="h-4 w-4" /> Overdue
            </span>
          )}
        </div>

        {/* Editable fields */}
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-ink-100 pt-4 dark:border-ink-800 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-ink-500">Status</label>
            <select
              className="input mt-1 py-1.5 text-sm"
              value={status}
              onChange={(e) => updateTask.mutate({ id: id!, status: e.target.value as TaskStatus })}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Priority</label>
            <select
              className="input mt-1 py-1.5 text-sm"
              value={priority}
              onChange={(e) => updateTask.mutate({ id: id!, priority: e.target.value as TaskPriority })}
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Assignee</label>
            <select
              className="input mt-1 py-1.5 text-sm"
              value={task.assignedTo?.id ?? ''}
              onChange={(e) => updateTask.mutate({ id: id!, assignedTo: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="card">
        <div className="border-b border-ink-200 px-5 py-3 dark:border-ink-800">
          <h2 className="font-semibold">Comments ({task.comments?.length ?? 0})</h2>
        </div>
        <div className="space-y-4 p-5">
          {task.comments && task.comments.length > 0 ? (
            task.comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar name={comment.user.name} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.user.name}</span>
                    <span className="text-xs text-ink-400">{formatRelative(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{comment.content}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-400">No comments yet</p>
          )}

          {/* Add comment */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newComment.trim()) {
                addComment.mutate({ taskId: id!, content: newComment.trim() });
              }
            }}
            className="flex gap-3 border-t border-ink-100 pt-4 dark:border-ink-800"
          >
            <Avatar name={useStoreState().user?.name || '?'} size="sm" />
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="input min-h-16"
                rows={2}
              />
              <div className="mt-2 flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={!newComment.trim() || addComment.isPending}>
                  {addComment.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
                  Comment
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Helper to avoid circular import
import { useStore } from '../lib/store';
function useStoreState() {
  return useStore();
}
