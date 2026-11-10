import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Avatar } from '../components/Avatar';
import { InlineLoader, Spinner } from '../components/Loading';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { formatDate, isOverdue, formatCurrency } from '../lib/utils';
import { KANBAN_COLUMNS } from '../../../shared/types';
import type { KanbanColumn } from '../../../shared/types';

export default function OperationsBoard() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.board.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const moveItem = trpc.board.move.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createItem = trpc.board.create.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      toast.success('Card created');
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItem = trpc.board.delete.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      toast.success('Card deleted');
    },
  });

  const handleDrop = (col: KanbanColumn) => {
    if (draggedId) {
      moveItem.mutate({ id: draggedId, column: col });
    }
    setDraggedId(null);
    setDragOverCol(null);
  };

  if (isLoading) return <InlineLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations Board</h1>
          <p className="text-sm text-ink-500">
            Track trade operations from order to delivery · Internal coordination only
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" /> New Card
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => {
          const colItems = items?.filter((item) => item.column === col.key) ?? [];
          return (
            <div
              key={col.key}
              className="flex w-72 flex-shrink-0 flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="badge bg-ink-100 text-ink-500 text-xs dark:bg-ink-800 dark:text-ink-400">
                  {colItems.length}
                </span>
              </div>

              {/* Column body */}
              <div
                className={`flex-1 space-y-2 rounded-lg p-2 transition-colors ${
                  dragOverCol === col.key ? 'bg-brand-50 dark:bg-brand-950/30' : ''
                }`}
              >
                {colItems.map((item) => {
                  const overdue = isOverdue(item.dueDate) && col.key !== 'completed';
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedId(item.id)}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverCol(null);
                      }}
                      className="group cursor-grab rounded-lg border border-ink-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-ink-700 dark:bg-ink-800"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-medium text-brand-600">
                          {item.orderRef}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this card?')) {
                              deleteItem.mutate({ id: item.id });
                            }
                          }}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-ink-400 hover:text-red-500" />
                        </button>
                      </div>

                      <p className="mt-1 text-sm font-medium">
                        {item.buyer} → {item.seller}
                      </p>

                      {item.amount && (
                        <p className="mt-1 text-xs font-semibold text-green-600">
                          {formatCurrency(item.amount, item.currency)}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        {item.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={item.assignee.name} size="xs" />
                            <span className="text-xs text-ink-400">
                              {item.assignee.name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">Unassigned</span>
                        )}
                        {item.dueDate && (
                          <span
                            className={`text-xs ${overdue ? 'font-medium text-red-600' : 'text-ink-400'}`}
                          >
                            {formatDate(item.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-ink-200 py-8 text-center text-xs text-ink-400 dark:border-ink-700">
                    Drop cards here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create card modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Operations Card" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createItem.mutate({
              orderRef: formData.get('orderRef') as string,
              buyer: formData.get('buyer') as string,
              seller: formData.get('seller') as string,
              amount: formData.get('amount') ? parseInt(formData.get('amount') as string) : null,
              currency: (formData.get('currency') as string) || 'GBP',
              column: (formData.get('column') as KanbanColumn) || 'new_order',
              assignedTo: (formData.get('assignedTo') as string) || null,
              dueDate: formData.get('dueDate')
                ? new Date(formData.get('dueDate') as string).toISOString()
                : null,
              notes: (formData.get('notes') as string) || null,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Order Reference</label>
              <input name="orderRef" className="input" required placeholder="ETI-2024-006" autoFocus />
            </div>
            <div>
              <label className="label">Column</label>
              <select name="column" className="input">
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Buyer</label>
              <input name="buyer" className="input" required placeholder="Buyer company" />
            </div>
            <div>
              <label className="label">Seller</label>
              <input name="seller" className="input" required placeholder="Seller company" />
            </div>
            <div>
              <label className="label">Amount</label>
              <input name="amount" type="number" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select name="currency" className="input" defaultValue="GBP">
                <option value="GBP">GBP (£)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="label">Assign to</label>
              <select name="assignedTo" className="input">
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input name="dueDate" type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" className="input" rows={2} placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={createItem.isPending}>
              {createItem.isPending ? <Spinner /> : 'Create Card'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
