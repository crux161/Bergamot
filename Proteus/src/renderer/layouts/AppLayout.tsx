import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Input, Toast, Select } from "@douyinfe/semi-ui";
import { ServerList } from "../components/ServerList";
import { ChannelList, DmConversation } from "../components/ChannelList";
import { ChatView } from "../components/ChatView";
import { MessageInput } from "../components/MessageInput";
import { MemberList } from "../components/MemberList";
import { SettingsPanel } from "../components/SettingsPanel";
import { ServerSettingsPanel } from "../components/ServerSettingsPanel";
import { TypingIndicator, TypingUser } from "../components/TypingIndicator";
import { GameletLibraryModal, GameletEntry } from "../components/GameletLibraryModal";
import { GameletPlayer } from "../components/GameletPlayer";
import { CallOverlay, CallState } from "../components/CallOverlay";
import * as api from "../services/api";
import { Permissions, hasPermission } from "../services/api";
import * as socket from "../services/socket";
import type { MessagePayload } from "../services/socket";

// ── Mock data for offline/development use ──

const MOCK_SERVERS: api.ServerRead[] = [
  { id: "1", name: "Mount Olympus", icon_url: null, owner_id: "0", created_at: "2025-01-01T00:00:00Z" },
  { id: "2", name: "Jade Palace", icon_url: null, owner_id: "0", created_at: "2025-01-02T00:00:00Z" },
];

const MOCK_CHANNELS: Record<string, api.ChannelRead[]> = {
  "1": [
    { id: "101", name: "general", topic: "Welcome to Mount Olympus", channel_type: "text", position: 0, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "102", name: "announcements", topic: "Important updates", channel_type: "text", position: 1, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "103", name: "off-topic", topic: null, channel_type: "text", position: 2, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "104", name: "voice-lounge", topic: null, channel_type: "voice", position: 3, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
  ],
  "2": [
    { id: "201", name: "general", topic: "The Jade Palace awaits", channel_type: "text", position: 0, server_id: "2", created_at: "2025-01-02T00:00:00Z" },
    { id: "202", name: "training", topic: "Sharpen your skills", channel_type: "text", position: 1, server_id: "2", created_at: "2025-01-02T00:00:00Z" },
  ],
};

const MOCK_MESSAGES: MessagePayload[] = [
  { id: "m1", content: "Has anyone seen the new gateway config?", sender_id: "u-artemis", channel_id: "101", timestamp: "2025-06-14T09:15:00Z" },
  { id: "m2", content: "Yeah, Hermes pushed an update last night. Channels are routing properly now.", sender_id: "u-hephaestus", channel_id: "101", timestamp: "2025-06-14T09:17:00Z" },
  { id: "m3", content: "Nice. I was getting timeout errors on the voice channels earlier.", sender_id: "u-athena", channel_id: "101", timestamp: "2025-06-14T09:20:00Z" },
  { id: "m4", content: "That should be resolved. Let me know if it happens again.", sender_id: "u-hephaestus", channel_id: "101", timestamp: "2025-06-14T09:21:00Z" },
  { id: "m5", content: "Quick question — are we still using Janus for auth or did that change?", sender_id: "u-apollo", channel_id: "101", timestamp: "2025-06-14T10:02:00Z" },
  { id: "m6", content: "Still Janus. The token flow goes through /api/v1/auth/login.", sender_id: "u-artemis", channel_id: "101", timestamp: "2025-06-14T10:05:00Z" },
  { id: "m7", content: "Perfect, thanks. Proteus frontend is almost wired up.", sender_id: "u-apollo", channel_id: "101", timestamp: "2025-06-14T10:06:00Z" },
  { id: "m8", content: "Here's the new architecture diagram:", sender_id: "u-athena", channel_id: "101", timestamp: "2025-06-14T10:10:00Z", attachments: [{ id: "att-1", filename: "architecture.png", content_type: "image/png", url: "https://placehold.co/400x300/2b2d31/6b9362?text=Architecture+Diagram" }] },
];

const MOCK_MEMBERS = [
  { id: "0", username: "Eain", display_name: "Eain", status: "online" as const },
  { id: "u-artemis", username: "Artemis", display_name: "Artemis", status: "online" as const },
  { id: "u-hephaestus", username: "Hephaestus", display_name: "Hephaestus", status: "idle" as const },
  { id: "u-athena", username: "Athena", display_name: "Athena", status: "online" as const },
  { id: "u-apollo", username: "Apollo", display_name: "Apollo", status: "dnd" as const },
  { id: "u-hermes", username: "Hermes", display_name: "Hermes", status: "offline" as const },
];

const MOCK_DM_CONVERSATIONS: DmConversation[] = [
  { id: "dm-1", userId: "u-artemis", username: "Artemis", displayName: "Artemis", status: "online", lastMessage: "Let me know if the gateway holds up" },
  { id: "dm-2", userId: "u-hephaestus", username: "Hephaestus", displayName: "Hephaestus", status: "idle", lastMessage: "I pushed the fix last night" },
  { id: "dm-3", userId: "u-athena", username: "Athena", displayName: "Athena", status: "online", lastMessage: "Architecture diagram is ready" },
  { id: "dm-4", userId: "u-apollo", username: "Apollo", displayName: "Apollo", status: "dnd", lastMessage: "Proteus frontend almost done", unreadCount: 2 },
  { id: "dm-5", userId: "u-hermes", username: "Hermes", displayName: "Hermes", status: "offline", lastMessage: "WebSocket gateway deployed" },
];

const MOCK_DM_MESSAGES: Record<string, MessagePayload[]> = {
  "dm-1": [
    { id: "dm-m1", content: "Hey, are you around? Need to check on the gateway.", sender_id: "0", channel_id: "dm-1", timestamp: "2025-06-14T08:30:00Z" },
    { id: "dm-m2", content: "Yeah, I'm here. What's up?", sender_id: "u-artemis", channel_id: "dm-1", timestamp: "2025-06-14T08:31:00Z" },
    { id: "dm-m3", content: "Just wanted to make sure the new routing config is stable.", sender_id: "0", channel_id: "dm-1", timestamp: "2025-06-14T08:32:00Z" },
    { id: "dm-m4", content: "Let me know if the gateway holds up", sender_id: "u-artemis", channel_id: "dm-1", timestamp: "2025-06-14T08:35:00Z" },
  ],
  "dm-2": [
    { id: "dm-m5", content: "The voice channel timeout issue should be fixed now.", sender_id: "u-hephaestus", channel_id: "dm-2", timestamp: "2025-06-14T07:00:00Z" },
    { id: "dm-m6", content: "I pushed the fix last night", sender_id: "u-hephaestus", channel_id: "dm-2", timestamp: "2025-06-14T07:01:00Z" },
  ],
  "dm-3": [
    { id: "dm-m7", content: "Architecture diagram is ready", sender_id: "u-athena", channel_id: "dm-3", timestamp: "2025-06-14T10:00:00Z" },
  ],
};

// All permissions (used for mock mode / server owner)
const ALL_PERMS = 0xFF;

interface Props {
  currentUser: api.UserRead;
  onLogout?: () => void;
  onUserUpdated?: (user: api.UserRead) => void;
}

export const AppLayout: React.FC<Props> = ({ currentUser, onLogout, onUserUpdated }) => {
  const [servers, setServers] = useState<api.ServerRead[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [channels, setChannels] = useState<api.ChannelRead[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [usingMockData, setUsingMockData] = useState(false);
  const [hermesConnected, setHermesConnected] = useState(false);
  const [myPermissions, setMyPermissions] = useState<number>(ALL_PERMS);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [showGameletLibrary, setShowGameletLibrary] = useState(false);
  const [activeGamelet, setActiveGamelet] = useState<GameletEntry | null>(null);

  // ── DM state ──
  const [dmMode, setDmMode] = useState(false);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [dmConversations] = useState<DmConversation[]>(MOCK_DM_CONVERSATIONS);

  // ── Call state ──
  const [callState, setCallState] = useState<CallState | null>(null);

  // Connect to Hermes on mount (graceful fallback)
  useEffect(() => {
    try {
      socket.connect();
      socket.onOpen(() => {
        console.log("[Proteus] Connected to Hermes");
        setHermesConnected(true);
      });
      socket.onError(() => {
        console.warn("[Proteus] Hermes connection error");
        setHermesConnected(false);
      });
      socket.onClose(() => {
        console.log("[Proteus] Hermes disconnected");
        setHermesConnected(false);
      });
    } catch {
      console.warn("[Proteus] Could not connect to Hermes");
      setHermesConnected(false);
    }
    return () => {
      try { socket.disconnect(); } catch { /* noop */ }
    };
  }, []);

  // Load servers (fall back to mock data)
  useEffect(() => {
    api.listServers().then((s: api.ServerRead[]) => {
      setServers(s);
      if (s.length > 0 && !activeServerId) {
        setActiveServerId(s[0].id);
      }
    }).catch(() => {
      console.warn("[Proteus] API unreachable — loading mock servers");
      setUsingMockData(true);
      setServers(MOCK_SERVERS);
      setActiveServerId(MOCK_SERVERS[0].id);
    });
  }, []);

  // Load channels + permissions when server changes
  useEffect(() => {
    if (!activeServerId || dmMode) return;
    setChannels([]);
    setActiveChannelId(null);
    setMessages([]);

    if (usingMockData) {
      setMyPermissions(ALL_PERMS);
      const mockChs = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChs);
      const firstText = mockChs.find((c) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
      return;
    }

    // Fetch permissions for this server
    api.getMyPermissions(activeServerId).then(setMyPermissions).catch(() => {
      setMyPermissions(ALL_PERMS); // Fallback: give all perms (e.g. owner)
    });

    api.listChannels(activeServerId).then((chs) => {
      setChannels(chs);
      const firstText = chs.find((c) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
    }).catch(() => {
      const mockChs = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChs);
      const firstText = mockChs.find((c) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
    });
  }, [activeServerId, usingMockData, dmMode]);

  // Load DM messages when a DM conversation is selected
  useEffect(() => {
    if (!dmMode || !activeDmId) return;
    // For now, use mock DM messages
    setMessages(MOCK_DM_MESSAGES[activeDmId] || []);
  }, [activeDmId, dmMode]);

  // Join channel when it changes — load history then subscribe to live messages
  useEffect(() => {
    if (!activeChannelId || dmMode) return;

    if (usingMockData) {
      setMessages(MOCK_MESSAGES.filter((m) => m.channel_id === activeChannelId));
      return;
    }

    setMessages([]);

    // Load persisted message history from Janus
    api.listMessages(activeChannelId).then((history) => {
      const mapped: MessagePayload[] = history.map((m) => ({
        id: String(m.id),
        content: m.content,
        sender_id: String(m.sender_id),
        channel_id: String(m.channel_id),
        timestamp: m.created_at,
        nonce: m.nonce || undefined,
        attachments: m.attachments || undefined,
      }));
      setMessages(mapped);
    }).catch((err) => {
      console.warn("[Proteus] Failed to load message history:", err);
    });

    // Subscribe to live messages via WebSocket
    const handleMessage = (msg: MessagePayload) => {
      setMessages((prev) => {
        // Deduplicate by nonce (sender already added their own message locally)
        if (msg.nonce && prev.some((m) => m.nonce === msg.nonce)) return prev;
        return [...prev, msg];
      });

      // When a user sends a message, remove them from the typing list
      setTypingUsers((prev) => prev.filter((u) => u.user_id !== msg.sender_id));
      const existingTimer = typingTimers.current.get(msg.sender_id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimers.current.delete(msg.sender_id);
      }
    };

    const handleTyping = (payload: { user_id: string; username: string }) => {
      // Don't show our own typing indicator
      if (payload.user_id === currentUser.id) return;

      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.user_id === payload.user_id);
        if (!exists) {
          return [...prev, { user_id: payload.user_id, username: payload.username }];
        }
        return prev;
      });

      // Reset the 3-second auto-expiry timer for this user
      const existing = typingTimers.current.get(payload.user_id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== payload.user_id));
        typingTimers.current.delete(payload.user_id);
      }, 3000);
      typingTimers.current.set(payload.user_id, timer);
    };

    try {
      socket.joinChannel(activeChannelId, handleMessage, handleTyping);
    } catch {
      // WebSocket unavailable — history from Janus is still shown
    }

    return () => {
      try { socket.leaveChannel(activeChannelId); } catch { /* noop */ }
      // Clear all typing state when leaving a channel
      setTypingUsers([]);
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
    };
  }, [activeChannelId, usingMockData, dmMode]);

  // ── Handlers ──

  const handleMessageSent = useCallback((msg: MessagePayload) => {
    // Hermes broadcasts exclude the sender, so we must add our own message locally
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (usingMockData || dmMode) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return;
    }
    if (!activeChannelId) return;
    try {
      await api.deleteMessage(activeChannelId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to delete message", duration: 2 });
    }
  }, [activeChannelId, usingMockData, dmMode]);

  const handleDeleteChannel = useCallback(async (channelId: string) => {
    if (!activeServerId) return;
    try {
      await api.deleteChannel(activeServerId, channelId);
      setChannels((prev) => {
        const updated = prev.filter((c) => c.id !== channelId);
        // If the deleted channel was active, select another
        if (activeChannelId === channelId) {
          const firstText = updated.find((c) => c.channel_type === "text");
          setActiveChannelId(firstText?.id || null);
        }
        return updated;
      });
      Toast.success({ content: "Channel deleted", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to delete channel", duration: 2 });
    }
  }, [activeServerId, activeChannelId]);

  const handleCreateServer = useCallback(async () => {
    if (!newServerName.trim()) return;
    try {
      const s = await api.createServer(newServerName.trim());
      setServers((prev) => [...prev, s]);
      setActiveServerId(s.id);
      setNewServerName("");
      setShowAddServer(false);
    } catch (err: any) {
      Toast.error(err.message);
    }
  }, [newServerName]);

  const handleCreateChannel = useCallback(async () => {
    if (!newChannelName.trim() || !activeServerId) return;
    try {
      const ch = await api.createChannel(activeServerId, newChannelName.trim(), newChannelType);
      setChannels((prev) => [...prev, ch]);
      setActiveChannelId(ch.id);
      setNewChannelName("");
      setNewChannelType("text");
      setShowAddChannel(false);
    } catch (err: any) {
      Toast.error(err.message);
    }
  }, [newChannelName, newChannelType, activeServerId]);

  // ── DM handlers ──

  const handleDmHome = useCallback(() => {
    setDmMode(true);
    setActiveChannelId(null);
    setMessages([]);
    // Select first DM if none selected
    if (!activeDmId && dmConversations.length > 0) {
      setActiveDmId(dmConversations[0].id);
    }
  }, [activeDmId, dmConversations]);

  const handleSelectServer = useCallback((serverId: string) => {
    setDmMode(false);
    setActiveDmId(null);
    setActiveServerId(serverId);
  }, []);

  const handleSelectDm = useCallback((dmId: string) => {
    setActiveDmId(dmId);
    setMessages(MOCK_DM_MESSAGES[dmId] || []);
  }, []);

  // ── Call handlers ──

  const handleStartCall = useCallback((type: "voice" | "video") => {
    if (!activeDmId) return;
    const dm = dmConversations.find((d) => d.id === activeDmId);
    if (!dm) return;
    setCallState({
      active: true,
      type,
      peerId: dm.userId,
      peerName: dm.displayName,
      peerAvatar: dm.avatarUrl,
    });
    Toast.info({ content: `Starting ${type} call with ${dm.displayName}...`, duration: 2 });
  }, [activeDmId, dmConversations]);

  const handleEndCall = useCallback(() => {
    setCallState(null);
    Toast.info({ content: "Call ended", duration: 1.5 });
  }, []);

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeDm = dmConversations.find((d) => d.id === activeDmId);

  const canManageChannels = hasPermission(myPermissions, Permissions.MANAGE_CHANNELS);
  const canManageMessages = hasPermission(myPermissions, Permissions.MANAGE_MESSAGES);
  const canOpenServerSettings = hasPermission(myPermissions, Permissions.MANAGE_SERVER)
    || hasPermission(myPermissions, Permissions.MANAGE_CHANNELS)
    || hasPermission(myPermissions, Permissions.MANAGE_ROLES);

  const members = usingMockData
    ? MOCK_MEMBERS
    : [{ id: currentUser.id, username: currentUser.username, display_name: currentUser.display_name, avatar_url: currentUser.avatar_url, status: (currentUser.status || "online") as "online" | "idle" | "dnd" | "offline", status_message: currentUser.status_message }];

  // Build a sender_id → display name map for ChatView
  const userMap: Record<string, string> = {};
  userMap[currentUser.id] = currentUser.display_name || currentUser.username;
  for (const m of members) {
    userMap[m.id] = m.display_name || m.username;
  }
  // Also add DM peer names to the map
  for (const dm of dmConversations) {
    userMap[dm.userId] = dm.displayName;
  }

  // Determine what to show in the chat area
  const chatChannelName = dmMode
    ? (activeDm?.displayName || "Direct Messages")
    : (activeChannel?.name || "");

  const chatChannelTopic = dmMode ? null : activeChannel?.topic;

  const showChat = dmMode ? !!activeDmId : !!activeChannel;

  return (
    <div className="app-layout">
      <div className="titlebar-drag" />

      <ServerList
        servers={servers}
        activeServerId={activeServerId}
        dmMode={dmMode}
        onSelect={handleSelectServer}
        onAdd={() => setShowAddServer(true)}
        onDmHome={handleDmHome}
      />

      {dmMode ? (
        <ChannelList
          serverName="Direct Messages"
          serverId=""
          channels={[]}
          activeChannelId={null}
          currentUser={currentUser}
          onSelect={() => {}}
          onOpenSettings={() => setShowSettings(true)}
          dmMode
          dmConversations={dmConversations}
          activeDmId={activeDmId}
          onSelectDm={handleSelectDm}
          onNewDm={() => Toast.info({ content: "New DM coming soon!", duration: 2 })}
          voiceConnected={!!callState}
          voiceChannelName={callState ? `Call — ${callState.peerName}` : undefined}
          onDisconnectVoice={handleEndCall}
        />
      ) : activeServer ? (
        <ChannelList
          serverName={activeServer.name}
          serverId={activeServer.id}
          channels={channels}
          activeChannelId={activeChannelId}
          currentUser={currentUser}
          onSelect={setActiveChannelId}
          onAddChannel={() => setShowAddChannel(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenServerSettings={() => setShowServerSettings(true)}
          onDeleteChannel={handleDeleteChannel}
          canManageChannels={canManageChannels}
          canOpenServerSettings={canOpenServerSettings}
        />
      ) : null}

      <div className="chat-area">
        {showChat ? (
          <>
            <ChatView
              channelName={chatChannelName}
              channelTopic={chatChannelTopic}
              messages={messages}
              userMap={userMap}
              currentUserId={currentUser.id}
              onDeleteMessage={handleDeleteMessage}
              canManageMessages={canManageMessages}
              isDm={dmMode}
              onVoiceCall={() => handleStartCall("voice")}
              onVideoCall={() => handleStartCall("video")}
            />
            <TypingIndicator typingUsers={typingUsers} />
            <MessageInput
              channelId={dmMode ? (activeDmId || "") : (activeChannel?.id || "")}
              channelName={chatChannelName}
              onMessageSent={handleMessageSent}
              mockMode={usingMockData || dmMode}
              wsConnected={hermesConnected}
              senderId={currentUser.id}
              senderName={currentUser.display_name || currentUser.username}
              onOpenGamelets={() => setShowGameletLibrary(true)}
            />
          </>
        ) : (
          <div className="chat-area__empty">
            {dmMode
              ? "Select a conversation"
              : servers.length === 0
                ? "Create a server to get started"
                : "Select a channel"}
          </div>
        )}

        {/* Gamelet overlay — positioned absolutely so it doesn't disturb flex layout.
            Unmounting restores the chat area to its exact prior state. */}
        {activeGamelet && (
          <GameletPlayer
            gameName={activeGamelet.name}
            gameUrl={activeGamelet.url}
            type={activeGamelet.type}
            gamepadMapping={activeGamelet.gamepadMapping}
            onLeave={() => setActiveGamelet(null)}
          />
        )}

        {/* Call overlay — positioned absolutely over the chat area */}
        {callState && (
          <CallOverlay
            call={callState}
            onEnd={handleEndCall}
          />
        )}
      </div>

      {dmMode ? (
        // In DM mode, show a user profile panel instead of member list
        activeDm && (
          <div className="dm-profile-sidebar">
            <div className="dm-profile-sidebar__header">
              <div className="dm-profile-sidebar__avatar-wrap">
                {activeDm.avatarUrl ? (
                  <img className="dm-profile-sidebar__avatar" src={activeDm.avatarUrl} alt="" />
                ) : (
                  <div className="dm-profile-sidebar__avatar dm-profile-sidebar__avatar--fallback">
                    {activeDm.displayName[0].toUpperCase()}
                  </div>
                )}
                <span className={`dm-profile-sidebar__status dm-profile-sidebar__status--${activeDm.status}`} />
              </div>
              <div className="dm-profile-sidebar__name">{activeDm.displayName}</div>
              <div className="dm-profile-sidebar__username">{activeDm.username}</div>
            </div>
            <div className="dm-profile-sidebar__section">
              <div className="dm-profile-sidebar__section-title">Member Since</div>
              <div className="dm-profile-sidebar__section-content">Jan 1, 2025</div>
            </div>
            <div className="dm-profile-sidebar__section">
              <div className="dm-profile-sidebar__section-title">Note</div>
              <input
                className="dm-profile-sidebar__note-input"
                placeholder="Click to add a note"
              />
            </div>
          </div>
        )
      ) : activeServer ? (
        <MemberList members={members} />
      ) : null}

      {/* Create Server Modal */}
      <Modal
        title="Create Server"
        visible={showAddServer}
        onOk={handleCreateServer}
        onCancel={() => setShowAddServer(false)}
        okText="Create"
        cancelText="Cancel"
        maskClosable={false}
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <Input
          value={newServerName}
          onChange={setNewServerName}
          placeholder="Server name"
          onKeyDown={(e) => e.key === "Enter" && handleCreateServer()}
          autoFocus
        />
      </Modal>

      {/* Create Channel Modal */}
      <Modal
        title="Create Channel"
        visible={showAddChannel}
        onOk={handleCreateChannel}
        onCancel={() => { setShowAddChannel(false); setNewChannelName(""); setNewChannelType("text"); }}
        okText="Create"
        cancelText="Cancel"
        maskClosable={false}
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            value={newChannelName}
            onChange={setNewChannelName}
            placeholder="Channel name"
            onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
            autoFocus
          />
          <Select
            value={newChannelType}
            onChange={(v) => setNewChannelType(v as "text" | "voice")}
            style={{ width: "100%" }}
          >
            <Select.Option value="text">Text Channel</Select.Option>
            <Select.Option value="voice">Voice Channel</Select.Option>
          </Select>
        </div>
      </Modal>

      {/* User Settings overlay */}
      {showSettings && (
        <SettingsPanel
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onLogout={() => {
            setShowSettings(false);
            if (onLogout) onLogout();
          }}
          onUserUpdated={onUserUpdated}
        />
      )}

      {/* Server Settings overlay */}
      {showServerSettings && activeServer && (
        <ServerSettingsPanel
          server={activeServer}
          currentUser={currentUser}
          myPermissions={myPermissions}
          onClose={() => setShowServerSettings(false)}
        />
      )}

      {/* Gamelet Library Modal */}
      <GameletLibraryModal
        visible={showGameletLibrary}
        onClose={() => setShowGameletLibrary(false)}
        onSelect={(g) => setActiveGamelet(g)}
      />
    </div>
  );
};
