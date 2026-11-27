import { Link, useNavigate } from "react-router-dom";
import { Search, MessageSquare } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useStore } from "../lib/store";
import { Avatar } from "../components/Avatar";
import { InlineLoader } from "../components/Loading";
import { toast } from "../components/Toast";
import { formatRelative } from "../lib/utils";
import { useState } from "react";

const roleColors: Record<string, string> = {
  admin: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  finance: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  operations: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  support:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  developer:
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

export default function Directory() {
  const navigate = useNavigate();
  const { user: currentUser } = useStore();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const [search, setSearch] = useState("");
  const [dmLoadingId, setDmLoadingId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const getOrCreateDM = trpc.messaging.getOrCreateDM.useMutation({
    onSuccess: (channel) => {
      utils.messaging.listChannels.invalidate();
      navigate(`/messages/${channel.id}`);
      setDmLoadingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDmLoadingId(null);
    },
  });

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
        <p className="text-sm text-ink-500">
          All team members at ETI & Partners
        </p>
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
          {filtered?.map((member) => {
            const lastActive = member.lastActiveAt;
            const recentlyActive = lastActive
              ? new Date(lastActive).getTime() > Date.now() - 5 * 60 * 1000
              : false;
            const isSelf = member.id === currentUser?.id;

            return (
              <div
                key={member.id}
                className="card p-5 transition-shadow hover:shadow-md"
              >
                {/* Top — avatar + info (links to profile) */}
                <Link
                  to={`/directory/${member.id}`}
                  className="flex items-start gap-3"
                >
                  <Avatar
                    name={member.name}
                    size="lg"
                    online={recentlyActive}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{member.name}</p>
                    {member.title && (
                      <p className="text-sm text-ink-500">{member.title}</p>
                    )}
                    <span
                      className={`badge mt-1.5 text-xs ${roleColors[member.role]}`}
                    >
                      {member.role}
                    </span>
                  </div>
                </Link>

                {/* Bottom — contact info + message button */}
                <div className="mt-4 space-y-1 text-xs text-ink-400">
                  <p className="truncate">{member.email}</p>
                  {member.phone && <p>{member.phone}</p>}
                  <p>
                    {recentlyActive ? (
                      <span className="text-green-600 font-medium">
                        ● Online now
                      </span>
                    ) : (
                      <span>Active {formatRelative(member.lastActiveAt)}</span>
                    )}
                  </p>
                </div>

                {/* Send Message button — hidden on own card */}
                {!isSelf && (
                  <button
                    onClick={() => {
                      setDmLoadingId(member.id);
                      getOrCreateDM.mutate({ userId: member.id });
                    }}
                    disabled={dmLoadingId === member.id}
                    className="btn btn-secondary mt-4 w-full text-sm"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {dmLoadingId === member.id ? "Opening…" : "Send Message"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
