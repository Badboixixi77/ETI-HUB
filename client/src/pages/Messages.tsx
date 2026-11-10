import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Hash, MessageSquare, Plus, Users as UsersIcon, Paperclip } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useStore } from '../lib/store';
import { getSocket, connectSocket } from '../lib/socket';
import { Avatar } from '../components/Avatar';
import { InlineLoader, Spinner } from '../components/Loading';
import { toast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { formatRelative, formatDateTime, cn } from '../lib/utils';

export default function Messages() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user } = useStore();
  const [messageText, setMessageText] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const utils = trpc.useUtils();

  const { data: channels, isLoading: channelsLoading } = trpc.messaging.listChannels.useQuery();
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
      // Broadcast via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('message_sent', { channelId: channelId!, message: { ...msg, sender: user } });
      }
      setMessageText('');
    },
    onError: (err) => toast.error(err.message),
  });

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!user) return;
    connectSocket(user.id);
    const socket = getSocket();

    const onNewMessage = (msg: { channelId: string }) => {
      if (msg.channelId === channelId) {
        utils.messaging.getMessages.invalidate({ channelId: channelId! });
      }
    };

    const onTyping = (data: { channelId: string; userName: string; isTyping: boolean }) => {
      if (data.channelId === channelId && data.userName !== user.name) {
        setTypingUsers((prev) => ({ ...prev, [data.userName]: data.isTyping }));
        if (data.isTyping) {
          if (typingTimeoutRef.current[data.userName]) {
            clearTimeout(typingTimeoutRef.current[data.userName]);
          }
          typingTimeoutRef.current[data.userName] = setTimeout(() => {
            setTypingUsers((prev) => ({ ...prev, [data.userName]: false }));
          }, 3000);
        }
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
    };
  }, [channelId, user, utils]);

  // Join channel room on socket
  useEffect(() => {
    if (channelId) {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('join_channel', channelId);
      } else {
        socket.once('connect', () => {
          socket.emit('join_channel', channelId);
        });
      }
    }
  }, [channelId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !channelId) return;
    sendMessage.mutate({ channelId, content: messageText.trim() });
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (channelId && user) {
      socket.emit('typing', { channelId, userName: user.name, isTyping: true });
    }
  };

  // Start or open a DM with a user
  const getOrCreateDM = trpc.messaging.getOrCreateDM.useMutation({
    onSuccess: (channel) => {
      utils.messaging.listChannels.invalidate();
      navigate(`/messages/${channel.id}`);
      setShowNewChannel(false);
    },
  });

  const createChannel = trpc.messaging.createChannel.useMutation({
    onSuccess: (channel) => {
      utils.messaging.listChannels.invalidate();
      navigate(`/messages/${channel.id}`);
      setShowNewChannel(false);
      toast.success('Channel created');
    },
  });

  const activeTypingUsers = Object.entries(typingUsers).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Channel sidebar */}
      <div className="hidden w-64 flex-col sm:flex">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Messages</h2>
          <button
            onClick={() => setShowNewChannel(true)}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="card flex-1 overflow-y-auto p-2">
          {channelsLoading ? (
            <InlineLoader />
          ) : channels && channels.length > 0 ? (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => navigate(`/messages/${channel.id}`)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  channel.id === channelId
                    ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/20 dark:text-brand-200'
                    : 'text-ink-600 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-800',
                )}
              >
                {channel.type === 'direct' ? (
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Hash className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate">
                  {channel.type === 'direct'
                    ? channel.name.replace('DM: ', '').split(' & ').find((n) => n !== user?.name) || channel.name
                    : channel.name}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-ink-400">
              No channels yet
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!channelId || !activeChannel ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-ink-300" />
              <p className="text-ink-400">Select a channel or start a DM</p>
            </div>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-2 border-b border-ink-200 pb-3 dark:border-ink-800">
              {activeChannel.type === 'direct' ? (
                <MessageSquare className="h-5 w-5 text-ink-400" />
              ) : (
                <Hash className="h-5 w-5 text-ink-400" />
              )}
              <h2 className="font-semibold">
                {activeChannel.type === 'direct'
                  ? activeChannel.name.replace('DM: ', '').split(' & ').find((n) => n !== user?.name) || activeChannel.name
                  : activeChannel.name}
              </h2>
              {activeChannel.description && (
                <span className="hidden text-xs text-ink-400 sm:inline">· {activeChannel.description}</span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              {messages && messages.length > 0 ? (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex gap-3', isMine && 'flex-row-reverse')}>
                      <Avatar name={msg.sender?.name || '?'} size="sm" />
                      <div className={cn('max-w-[70%]', isMine && 'text-right')}>
                        <div className="flex items-center gap-2" style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}>
                          <span className="text-xs font-medium">{msg.sender?.name}</span>
                          <span className="text-xs text-ink-400">{formatDateTime(msg.createdAt)}</span>
                        </div>
                        <div
                          className={cn(
                            'mt-1 inline-block rounded-lg px-3 py-2 text-sm',
                            isMine
                              ? 'bg-brand-900 text-white'
                              : 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100',
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.attachmentUrl && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-1 text-xs underline opacity-80"
                            >
                              <Paperclip className="h-3 w-3" /> {msg.attachmentName || 'Attachment'}
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

              {/* Typing indicator */}
              {activeTypingUsers.length > 0 && (
                <div className="px-2 text-xs text-ink-400">
                  {activeTypingUsers.join(', ')} {activeTypingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink-200 pt-3 dark:border-ink-800">
              <input
                type="text"
                className="input flex-1"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                disabled={sendMessage.isPending}
              />
              <button type="submit" className="btn btn-primary" disabled={!messageText.trim() || sendMessage.isPending}>
                {sendMessage.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </>
        )}
      </div>

      {/* New channel modal */}
      <Modal open={showNewChannel} onClose={() => setShowNewChannel(false)} title="New Conversation" size="lg">
        <div className="space-y-4">
          {/* New channel */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const memberIds = formData.getAll('members') as string[];
              createChannel.mutate({
                name: formData.get('name') as string,
                description: (formData.get('description') as string) || undefined,
                memberIds,
              });
            }}
            className="space-y-4"
          >
            <div className="border-b border-ink-100 pb-4 dark:border-ink-800">
              <h3 className="mb-3 text-sm font-semibold">Create Group Channel</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Channel name</label>
                  <input name="name" className="input" required placeholder="e.g. q4-launch" autoFocus />
                </div>
                <div>
                  <label className="label">Description (optional)</label>
                  <input name="description" className="input" placeholder="What's this channel about?" />
                </div>
                <div>
                  <label className="label">Members</label>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {users?.filter((u) => u.id !== user?.id).map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="members" value={u.id} className="rounded" />
                        {u.name} <span className="text-ink-400">· {u.role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3 w-full" disabled={createChannel.isPending}>
                {createChannel.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} Create Channel
              </button>
            </div>
          </form>

          {/* DM */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Start Direct Message</h3>
            <div className="space-y-1">
              {users?.filter((u) => u.id !== user?.id).map((u) => (
                <button
                  key={u.id}
                  onClick={() => getOrCreateDM.mutate({ userId: u.id })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Avatar name={u.name} size="sm" />
                  <span className="flex-1 text-left">{u.name}</span>
                  <span className="text-xs text-ink-400">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
