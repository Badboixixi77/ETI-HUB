import { useState } from "react";
import { FileText, Upload, Trash2, File, ChevronRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useStore } from "../lib/store";
import { Avatar } from "../components/Avatar";
import { InlineLoader, Spinner } from "../components/Loading";
import { Modal } from "../components/Modal";
import { toast } from "../components/Toast";
import { formatDate } from "../lib/utils";

const categoryLabels: Record<string, string> = {
  contract: "Contracts",
  invoice: "Invoices",
  compliance: "Compliance",
  meeting_notes: "Meeting Notes",
  other: "Other",
};

const categoryColors: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  invoice: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  compliance:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  meeting_notes:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  other: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
};

export default function DocumentVault() {
  const utils = trpc.useUtils();
  const { user: currentUser } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const { data: documents, isLoading } = trpc.documents.list.useQuery(
    filter !== "all" ? { category: filter as any } : undefined,
  );
  const { data: doc } = trpc.documents.getById.useQuery(
    { id: selectedDoc! },
    { enabled: !!selectedDoc },
  );

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDoc = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      toast.success("Document uploaded");
      setShowUpload(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      toast.success("Document deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-sm text-ink-500">
            Store and manage internal documents
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn btn-primary">
          <Upload className="h-4 w-4" /> Upload
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`badge px-3 py-1.5 text-sm ${filter === "all" ? "bg-brand-900 text-white" : "btn-secondary"}`}
        >
          All
        </button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`badge px-3 py-1.5 text-sm ${filter === key ? "bg-brand-900 text-white" : "btn-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Documents */}
      {isLoading ? (
        <InlineLoader />
      ) : documents && documents.length > 0 ? (
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {documents.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedDoc(d.id)}
              className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[d.category]}`}
              >
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{d.name}</p>
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span className={`badge ${categoryColors[d.category]}`}>
                    {categoryLabels[d.category]}
                  </span>
                  <span>·</span>
                  <span>{formatDate(d.createdAt)}</span>
                  {d.uploadedBy && (
                    <span>· Uploaded by {d.uploadedBy.name}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-400" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card px-5 py-12 text-center">
          <File className="mx-auto mb-3 h-10 w-10 text-ink-300" />
          <p className="text-sm text-ink-400">
            No documents found. Upload one to get started.
          </p>
        </div>
      )}

      {/* Document detail modal */}
      <Modal
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title="Document Details"
        size="lg"
      >
        {doc && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{doc.name}</h3>
              <span
                className={`badge mt-1 text-xs ${categoryColors[doc.category]}`}
              >
                {categoryLabels[doc.category]}
              </span>
            </div>
            {doc.description && (
              <p className="text-sm text-ink-500">{doc.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-ink-400">
              <Avatar name={doc.uploadedBy?.name || "?"} size="xs" />
              <span>
                Uploaded by {doc.uploadedBy?.name} on{" "}
                {formatDate(doc.createdAt)}
              </span>
            </div>

            {/* Version history */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Version History</h4>
              <div className="space-y-2">
                {doc.versions?.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 dark:border-ink-700"
                  >
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-ink-400" />
                      <div>
                        <p className="text-sm font-medium">
                          Version {v.version}
                        </p>
                        <p className="text-xs text-ink-400">
                          {formatDate(v.createdAt)} · {v.uploadedBy?.name}
                          {v.fileSize
                            ? ` · ${(v.fileSize / 1024).toFixed(0)} KB`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete (admin only) */}
            {currentUser?.role === "admin" && (
              <button
                onClick={() => {
                  if (confirm("Delete this document?")) {
                    deleteDoc.mutate({ id: doc.id });
                    setSelectedDoc(null);
                  }
                }}
                className="btn btn-danger w-full"
              >
                <Trash2 className="h-4 w-4" /> Delete Document
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Upload modal */}
      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Document"
        size="lg"
      >
        <UploadForm
          getUploadUrl={getUploadUrl}
          createDoc={createDoc}
          onCancel={() => setShowUpload(false)}
        />
      </Modal>
    </div>
  );
}

function UploadForm({ getUploadUrl, createDoc, onCancel }: any) {
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const file = formData.get("file") as File;
    if (!file) {
      toast.error("Please select a file");
      setUploading(false);
      return;
    }

    try {
      // Get presigned URL
      const { uploadUrl, key } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type,
      });

      // Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Create document record
      await createDoc.mutateAsync({
        name: formData.get("name") as string,
        category: formData.get("category") as any,
        description: (formData.get("description") as string) || null,
        fileKey: key,
        fileSize: file.size,
      });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Document name</label>
        <input
          name="name"
          className="input"
          required
          placeholder="Contract - Oct 2024"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Category</label>
        <select name="category" className="input" defaultValue="other">
          <option value="contract">Contract</option>
          <option value="invoice">Invoice</option>
          <option value="compliance">Compliance Certificate</option>
          <option value="meeting_notes">Meeting Notes</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea
          name="description"
          className="input"
          rows={2}
          placeholder="Brief description"
        />
      </div>
      <div>
        <label className="label">File</label>
        <input name="file" type="file" className="input" required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? <Spinner /> : <Upload className="h-4 w-4" />} Upload
        </button>
      </div>
    </form>
  );
}
