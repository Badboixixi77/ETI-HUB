import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Avatar } from "../components/Avatar";
import { InlineLoader, Spinner } from "../components/Loading";
import { Modal } from "../components/Modal";
import { toast } from "../components/Toast";
import { formatDate, isOverdue, formatCurrency } from "../lib/utils";
import { KANBAN_COLUMNS } from "../../../shared/types";
import type { KanbanColumn } from "../../../shared/types";

type BoardItem = {
  id: string;
  orderRef: string;
  buyer: string;
  seller: string;
  amount: number | null;
  currency: string;
  column: KanbanColumn;
  assignedTo: string | null;
  dueDate: string | null;
  notes: string | null;
  assignee?: { id: string; name: string } | null;
};

export default function OperationsBoard() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.board.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BoardItem | null>(null);

  const moveItem = trpc.board.move.useMutation({
    onSuccess: () => utils.board.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const createItem = trpc.board.create.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      toast.success("Card created");
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateItem = trpc.board.update.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      toast.success("Card updated");
      setSelectedCard(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItem = trpc.board.delete.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      toast.success("Card deleted");
      setSelectedCard(null);
    },
  });

  const handleDrop = (col: KanbanColumn) => {
    if (draggedId) moveItem.mutate({ id: draggedId, column: col });
    setDraggedId(null);
    setDragOverCol(null);
  };

  if (isLoading) return <InlineLoader />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Operations Board</h1>
          <p className="text-sm text-ink-500">
            Track trade operations · Internal coordination only
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Card</span>
        </button>
      </div>

      <p className="text-xs text-ink-400 sm:hidden">
        ← Swipe to see all columns →
      </p>

      {/* Kanban board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div
          className="flex gap-3 sm:gap-4"
          style={{ minWidth: "max-content" }}
        >
          {KANBAN_COLUMNS.map((col) => {
            const colItems =
              items?.filter((item) => item.column === col.key) ?? [];
            return (
              <div
                key={col.key}
                className="flex w-64 flex-shrink-0 flex-col sm:w-72"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.key);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="badge bg-ink-100 text-ink-500 text-xs dark:bg-ink-800 dark:text-ink-400">
                    {colItems.length}
                  </span>
                </div>

                <div
                  className={`flex-1 space-y-2 rounded-lg p-2 transition-colors ${dragOverCol === col.key ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}
                >
                  {colItems.map((item) => {
                    const overdue =
                      isOverdue(item.dueDate) && col.key !== "completed";
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDraggedId(item.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverCol(null);
                        }}
                        onClick={() => setSelectedCard(item as BoardItem)}
                        className="group cursor-pointer rounded-lg border border-ink-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-ink-700 dark:bg-ink-800"
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-mono text-xs font-medium text-brand-600">
                            {item.orderRef}
                          </span>
                          <Pencil className="h-3.5 w-3.5 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-sm font-medium line-clamp-2">
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
                                {item.assignee.name.split(" ")[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-400">
                              Unassigned
                            </span>
                          )}
                          {item.dueDate && (
                            <span
                              className={`text-xs ${overdue ? "font-medium text-red-600" : "text-ink-400"}`}
                            >
                              {formatDate(item.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-xs text-ink-400 dark:border-ink-700">
                      Drop cards here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Detail / Edit Modal */}
      <Modal
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        title="Order Card"
        size="lg"
      >
        {selectedCard && (
          <CardEditForm
            card={selectedCard}
            users={users ?? []}
            onSave={(data) =>
              updateItem.mutate({ id: selectedCard.id, ...data })
            }
            onDelete={() => {
              if (confirm("Delete this card?"))
                deleteItem.mutate({ id: selectedCard.id });
            }}
            isSaving={updateItem.isPending}
            isDeleting={deleteItem.isPending}
          />
        )}
      </Modal>

      {/* Create Card Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Operations Card"
        size="lg"
      >
        <CardCreateForm
          users={users ?? []}
          onSubmit={(data) => createItem.mutate(data)}
          onCancel={() => setShowCreate(false)}
          isSaving={createItem.isPending}
        />
      </Modal>
    </div>
  );
}

function CardEditForm({
  card,
  users,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  card: BoardItem;
  users: Array<{ id: string; name: string }>;
  onSave: (data: any) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          orderRef: fd.get("orderRef"),
          buyer: fd.get("buyer"),
          seller: fd.get("seller"),
          amount: fd.get("amount")
            ? parseInt(fd.get("amount") as string)
            : null,
          currency: fd.get("currency"),
          column: fd.get("column") as KanbanColumn,
          assignedTo: (fd.get("assignedTo") as string) || null,
          dueDate: fd.get("dueDate")
            ? new Date(fd.get("dueDate") as string).toISOString()
            : null,
          notes: (fd.get("notes") as string) || null,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Order Reference</label>
          <input
            name="orderRef"
            className="input"
            required
            defaultValue={card.orderRef}
          />
        </div>
        <div>
          <label className="label">Column</label>
          <select name="column" className="input" defaultValue={card.column}>
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Buyer</label>
          <input
            name="buyer"
            className="input"
            required
            defaultValue={card.buyer}
          />
        </div>
        <div>
          <label className="label">Seller</label>
          <input
            name="seller"
            className="input"
            required
            defaultValue={card.seller}
          />
        </div>
        <div>
          <label className="label">Amount</label>
          <input
            name="amount"
            type="number"
            className="input"
            defaultValue={card.amount ?? ""}
            placeholder="0"
          />
        </div>
        <div>
          <label className="label">Currency</label>
          <select
            name="currency"
            className="input"
            defaultValue={card.currency}
          >
            <option value="GBP">GBP (£)</option>
            <option value="NGN">NGN (₦)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div>
          <label className="label">Assign to</label>
          <select
            name="assignedTo"
            className="input"
            defaultValue={card.assignedTo ?? ""}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due date</label>
          <input
            name="dueDate"
            type="date"
            className="input"
            defaultValue={card.dueDate ? card.dueDate.split("T")[0] : ""}
          />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          name="notes"
          className="input"
          rows={3}
          defaultValue={card.notes ?? ""}
          placeholder="Optional notes"
        />
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-danger"
          disabled={isDeleting}
        >
          {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />} Delete
          Card
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? <Spinner /> : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function CardCreateForm({
  users,
  onSubmit,
  onCancel,
  isSaving,
}: {
  users: Array<{ id: string; name: string }>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          orderRef: fd.get("orderRef"),
          buyer: fd.get("buyer"),
          seller: fd.get("seller"),
          amount: fd.get("amount")
            ? parseInt(fd.get("amount") as string)
            : null,
          currency: (fd.get("currency") as string) || "GBP",
          column: (fd.get("column") as KanbanColumn) || "new_order",
          assignedTo: (fd.get("assignedTo") as string) || null,
          dueDate: fd.get("dueDate")
            ? new Date(fd.get("dueDate") as string).toISOString()
            : null,
          notes: (fd.get("notes") as string) || null,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Order Reference</label>
          <input
            name="orderRef"
            className="input"
            required
            placeholder="ETI-2024-007"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Column</label>
          <select name="column" className="input">
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Buyer</label>
          <input
            name="buyer"
            className="input"
            required
            placeholder="Buyer company"
          />
        </div>
        <div>
          <label className="label">Seller</label>
          <input
            name="seller"
            className="input"
            required
            placeholder="Seller company"
          />
        </div>
        <div>
          <label className="label">Amount</label>
          <input
            name="amount"
            type="number"
            className="input"
            placeholder="0"
          />
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
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
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
        <textarea
          name="notes"
          className="input"
          rows={2}
          placeholder="Optional notes"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? <Spinner /> : "Create Card"}
        </button>
      </div>
    </form>
  );
}
