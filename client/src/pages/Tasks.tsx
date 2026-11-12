import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Filter,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { Modal } from "../components/Modal";
import { Avatar } from "../components/Avatar";
import { InlineLoader } from "../components/Loading";
import { toast } from "../components/Toast";
import { formatDate, isOverdue } from "../lib/utils";
import { cn } from "../lib/utils";
import type { TaskStatus, TaskPriority } from "../../../shared/types";

const statusConfig: Record<
  TaskStatus,
  { label: string; icon: typeof Clock; color: string }
> = {
  todo: { label: "To Do", icon: CheckSquare, color: "text-ink-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500" },
  blocked: { label: "Blocked", icon: AlertCircle, color: "text-red-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-green-500" },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: {
    label: "Low",
    color: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  },
  medium: {
    label: "Medium",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  high: {
    label: "High",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export default function Tasks() {
  const [filter, setFilter] = useState<{
    status?: TaskStatus;
    priority?: TaskPriority;
    mine?: boolean;
  }>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: tasks, isLoading } = trpc.tasks.list.useQuery(filter);
  const { data: users } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Task created");
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const hasActiveFilters = filter.status || filter.priority || filter.mine;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Tasks</h1>
          <p className="text-sm text-ink-500">
            Create, assign, and track team work
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn btn-secondary p-2 sm:px-4",
              hasActiveFilters && "ring-2 ring-brand-500",
            )}
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {
                  [filter.status, filter.priority, filter.mine].filter(Boolean)
                    .length
                }
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card space-y-3 p-4 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:space-y-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-500 w-14">
              Status
            </label>
            <select
              className="input flex-1 py-1.5 text-sm"
              value={filter.status ?? ""}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  status: (e.target.value || undefined) as
                    TaskStatus | undefined,
                })
              }
            >
              <option value="">All</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-500 w-14">
              Priority
            </label>
            <select
              className="input flex-1 py-1.5 text-sm"
              value={filter.priority ?? ""}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  priority: (e.target.value || undefined) as
                    TaskPriority | undefined,
                })
              }
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!filter.mine}
                onChange={(e) =>
                  setFilter({ ...filter, mine: e.target.checked || undefined })
                }
                className="h-4 w-4 rounded"
              />
              Only mine
            </label>
            {hasActiveFilters && (
              <button
                onClick={() => setFilter({})}
                className="text-xs text-brand-600 hover:underline sm:ml-4"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task list */}
      {isLoading ? (
        <InlineLoader />
      ) : (
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {tasks && tasks.length > 0 ? (
            tasks.map((task) => {
              const status = task.status as TaskStatus;
              const priority = task.priority as TaskPriority;
              const StatusIcon = statusConfig[status].icon;
              return (
                <Link
                  key={task.id}
                  to={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50 active:bg-ink-100 dark:hover:bg-ink-800/50 sm:px-5 sm:py-4"
                >
                  <StatusIcon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      statusConfig[status].color,
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-sm sm:text-base">
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "badge text-xs",
                          priorityConfig[priority].color,
                        )}
                      >
                        {priorityConfig[priority].label}
                      </span>
                      <span className="text-xs text-ink-400">
                        Due {formatDate(task.dueDate)}
                      </span>
                      {isOverdue(task.dueDate) && status !== "done" && (
                        <span className="badge bg-red-100 text-red-700 text-xs dark:bg-red-950 dark:text-red-300">
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                  {task.assignee && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Avatar name={task.assignee.name} size="xs" />
                      <span className="hidden text-xs text-ink-400 sm:inline">
                        {task.assignee.name.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })
          ) : (
            <div className="px-5 py-12 text-center">
              <CheckSquare className="mx-auto mb-3 h-10 w-10 text-ink-300" />
              <p className="text-sm text-ink-400">No tasks found.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="btn btn-primary mt-4"
              >
                <Plus className="h-4 w-4" /> Create first task
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Task"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            createTask.mutate({
              title: fd.get("title") as string,
              description: (fd.get("description") as string) || undefined,
              priority: fd.get("priority") as TaskPriority,
              assignedTo: (fd.get("assignedTo") as string) || null,
              dueDate: fd.get("dueDate")
                ? new Date(fd.get("dueDate") as string).toISOString()
                : null,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Title</label>
            <input
              name="title"
              className="input"
              required
              placeholder="Task title"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              className="input min-h-[5rem]"
              rows={3}
              placeholder="Add details…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Assign to</label>
              <select name="assignedTo" className="input">
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" className="input" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due date</label>
            <input name="dueDate" type="date" className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createTask.isPending}
            >
              Create Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
