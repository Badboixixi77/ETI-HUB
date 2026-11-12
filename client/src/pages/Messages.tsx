import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Send,
  Hash,
  MessageSquare,
  Plus,
  Paperclip,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { useStore } from "../lib/store";
import { getSocket, connectSocket } from "../lib/socket";
import { Avatar } from "../components/Avatar";
import { InlineLoader, Spinner } from "../components/Loading";
import { toast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { formatDateTime, cn } from "../lib/utils";

export default function Messages() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user } = useStore();
  const [messageText, setMessageText] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showChannelList, setShowChannelList] = useState(!channelId); // show list by default on mobile if no channel selected
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const utils = trpc.useUtils();
  const { data: channels, isLoading: channelsLoading } =
    trpc.messaging.listChannels.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const activeChannel = useMemo(
    () => channels?.find((c) => c.id === channelId),
    [channels, channelId],
  );

  const { data: messages } = trpc.messaging.getMessages.useQuery(
    { channelId: channelId! },
    { enabled: !!channelId },
  );

  const sendMessage = trpc.messaging.sendMessage.useMutation({
    onSuccess: (msg) => {
      utils.messaging.getMessages.invalidate({ channelId: channelId! });
      const socket = getSocket();
      if (socket)
        socket.emit("message_sent", {
          channelId: channelId!,
          message: { ...msg, sender: user },
        });
      setMessageText("");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!user) return;
    connectSocket(user.id);
    const socket = getSocket();
    const onNewMessage = (msg: { channelId: string }) => {
      if (msg.channelId === channelId)
        utils.messaging.getMessages.invalidate({ channelId: channelId! });
    };
    const onTyping = (data: {
      channelId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      if (data.channelId === channelId && data.userName !== user.name) {
        setTypingUsers((prev) => ({ ...prev, [data.userName]: data.isTyping }));
        if (data.isTyping) {
          if (typingTimeoutRef.current[data.userName])
            clearTimeout(typingTimeoutRef.current[data.userName]);
          typingTimeoutRef.current[data.userName] = setTimeout(
            () =>
              setTypingUsers((prev) => ({ ...prev, [data.userName]: false })),
            3000,
          );
        }
      }
    };
    socket.on("new_message", onNewMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("typing", onTyping);
    };
  }, [channelId, user, utils]);

  useEffect(() => {
    if (channelId) {
      const socket = getSocket();
      const join = () => socket.emit("join_channel", channelId);
      if (socket.connected) join();
      else socket.once("connect", join);
    }
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When a channel is selected on mobile, hide the list
  const handleSelectChannel = (id: string) => {
    navigate(`/messages/${id}`);
    setShowChannelList(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !channelId) return;
    sendMessage.mutate({ channelId, content: messageText.trim() });
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (channelId && user)
      socket.emit("typing", { channelId, userName: user.name, isTyping: true });
  };

  const getOrCreateDM = trpc.messaging.getOrCreateDM.useMutation({
    onSuccess: (channel) => {
      utils.messaging.listChannels.invalidate();
      handleSelectChannel(channel.id);
      setShowNewChannel(false);
    },
  });

  const createChannel = trpc.messaging.createChannel.useMutation({
    onSuccess: (channel) => {
      utils.messaging.listChannels.invalidate();
      handleSelectChannel(channel.id);
      setShowNewChannel(false);
      toast.success("Channel created");
    },
  });

  const activeTypingUsers = Object.entries(typingUsers)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const channelDisplayName = (ch: { name: string; type: string }) =>
    ch.type === "direct"
      ? ch.name
          .replace("DM: ", "")
          .split(" & ")
          .find((n) => n !== user?.name) || ch.name
      : ch.name;

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-0 overflow-hidden rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900 sm:gap-0">
      {/* ── Channel list panel ─────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-ink-200 dark:border-ink-800",
          // Mobile: full-width when visible, hidden when in chat
          "w-full flex-shrink-0 sm:w-64",
          channelId && !showChannelList ? "hidden sm:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 dark:border-ink-800">
          <h2 className="font-semibold">Messages</h2>
          <button
            onClick={() => setShowNewChannel(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {channelsLoading ? (
            <InlineLoader />
          ) : channels && channels.length > 0 ? (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleSelectChannel(channel.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors min-h-[44px]",
                  channel.id === channelId
                    ? "bg-brand-50 text-brand-900 dark:bg-brand-900/20 dark:text-brand-200"
                    : "text-ink-600 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-800",
                )}
              >
                {channel.type === "direct" ? (
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Hash className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate text-left">
                  {channelDisplayName(channel)}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-ink-400">
              No channels yet.{" "}
              <button
                onClick={() => setShowNewChannel(true)}
                className="text-brand-600 underline"
              >
                Start one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          // Mobile: hide when showing channel list
          showChannelList && !channelId ? "hidden sm:flex" : "flex",
          channelId && showChannelList ? "hidden sm:flex" : "",
        )}
      >
        {!channelId || !activeChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <MessageSquare className="h-12 w-12 text-ink-300" />
            <p className="text-ink-400">Select a channel or start a DM</p>
            <button
              onClick={() => setShowChannelList(true)}
              className="btn btn-secondary sm:hidden"
            >
              View channels
            </button>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-800">
              {/* Back button — mobile only */}
              <button
                onClick={() => setShowChannelList(true)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 sm:hidden dark:hover:bg-ink-800"
                aria-label="Back to channels"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {activeChannel.type === "direct" ? (
                <MessageSquare className="h-5 w-5 flex-shrink-0 text-ink-400" />
              ) : (
                <Hash className="h-5 w-5 flex-shrink-0 text-ink-400" />
              )}
              <h2 className="truncate font-semibold">
                {channelDisplayName(activeChannel)}
              </h2>
              {activeChannel.description && (
                <span className="hidden truncate text-xs text-ink-400 sm:inline">
                  · {activeChannel.description}
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages && messages.length > 0 ? (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-2", isMine && "flex-row-reverse")}
                    >
                      <Avatar
                        name={msg.sender?.name || "?"}
                        size="sm"
                        className="flex-shrink-0 self-end"
                      />
                      <div
                        className={cn(
                          "max-w-[80%] sm:max-w-[70%]",
                          isMine && "items-end",
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 flex items-center gap-1.5 text-xs text-ink-400",
                            isMine && "flex-row-reverse",
                          )}
                        >
                          <span className="font-medium text-ink-600 dark:text-ink-300">
                            {msg.sender?.name}
                          </span>
                          <span>{formatDateTime(msg.createdAt)}</span>
                        </div>
                        <div
                          className={cn(
                            "inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed",
                            isMine
                              ? "rounded-br-sm bg-brand-900 text-white"
                              : "rounded-bl-sm bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          {msg.attachmentUrl && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-1 text-xs underline opacity-80"
                            >
                              <Paperclip className="h-3 w-3" />{" "}
                              {msg.attachmentName || "Attachment"}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-400">
                  No messages yet. Start the conversation!
                </div>
              )}

              {activeTypingUsers.length > 0 && (
                <p className="text-xs text-ink-400">
                  {activeTypingUsers.join(", ")}{" "}
                  {activeTypingUsers.length === 1 ? "is" : "are"} typing…
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="flex items-end gap-2 border-t border-ink-200 px-4 py-3 dark:border-ink-800"
            >
              <input
                type="text"
                className="input flex-1"
                placeholder="Type a message…"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                disabled={sendMessage.isPending}
              />
              <button
                type="submit"
                className="btn btn-primary h-10 w-10 flex-shrink-0 p-0"
                disabled={!messageText.trim() || sendMessage.isPending}
                aria-label="Send"
              >
                {sendMessage.isPending ? (
                  <Spinner />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* New conversation modal */}
      <Modal
        open={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        title="New Conversation"
        size="lg"
      >
        <div className="space-y-5">
          {/* DM — shown first on mobile since it's simpler */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Direct Message</h3>
            <div className="space-y-1">
              {users
                ?.filter((u) => u.id !== user?.id)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => getOrCreateDM.mutate({ userId: u.id })}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-ink-100 dark:hover:bg-ink-800 min-h-[44px]"
                  >
                    <Avatar name={u.name} size="sm" />
                    <span className="flex-1 text-left font-medium">
                      {u.name}
                    </span>
                    <span className="text-xs text-ink-400 capitalize">
                      {u.role}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="border-t border-ink-200 dark:border-ink-800" />

          {/* Group channel */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createChannel.mutate({
                name: fd.get("name") as string,
                description: (fd.get("description") as string) || undefined,
                memberIds: fd.getAll("members") as string[],
              });
            }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold">Create Group Channel</h3>
            <div>
              <label className="label">Channel name</label>
              <input
                name="name"
                className="input"
                required
                placeholder="e.g. q4-launch"
              />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input
                name="description"
                className="input"
                placeholder="What's this for?"
              />
            </div>
            <div>
              <label className="label">Members</label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2 dark:border-ink-700">
                {users
                  ?.filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800"
                    >
                      <input
                        type="checkbox"
                        name="members"
                        value={u.id}
                        className="h-4 w-4 rounded"
                      />
                      <span>{u.name}</span>
                      <span className="text-xs text-ink-400 capitalize">
                        · {u.role}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={createChannel.isPending}
            >
              {createChannel.isPending ? (
                <Spinner />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Create Channel
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
