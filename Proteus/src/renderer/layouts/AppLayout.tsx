import React, { useState, useEffect, useCallback } from "react";
import { Modal, Input, Toast } from "@douyinfe/semi-ui";
import { ServerList } from "../components/ServerList";
import { ChannelList } from "../components/ChannelList";
import { ChatView } from "../components/ChatView";
import { MessageInput } from "../components/MessageInput";
import { MemberList } from "../components/MemberList";
import * as api from "../services/api";
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
];

const MOCK_MEMBERS = [
  { id: "0", username: "Eain", display_name: "Eain", status: "online" as const },
  { id: "u-artemis", username: "Artemis", display_name: "Artemis", status: "online" as const },
  { id: "u-hephaestus", username: "Hephaestus", display_name: "Hephaestus", status: "idle" as const },
  { id: "u-athena", username: "Athena", display_name: "Athena", status: "online" as const },
  { id: "u-apollo", username: "Apollo", display_name: "Apollo", status: "dnd" as const },
  { id: "u-hermes", username: "Hermes", display_name: "Hermes", status: "offline" as const },
];

interface Props {
  currentUser: api.UserRead;
}

export const AppLayout: React.FC<Props> = ({ currentUser }) => {
  const [servers, setServers] = useState<api.ServerRead[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [channels, setChannels] = useState<api.ChannelRead[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [usingMockData, setUsingMockData] = useState(false);

  // Connect to Hermes on mount (graceful fallback)
  useEffect(() => {
    try {
      socket.connect();
    } catch {
      console.warn("[Proteus] Could not connect to Hermes — using mock data");
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

  // Load channels when server changes (fall back to mock data)
  useEffect(() => {
    if (!activeServerId) return;
    setChannels([]);
    setActiveChannelId(null);
    setMessages([]);

    if (usingMockData) {
      const mockChs = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChs);
      const firstText = mockChs.find((c: api.ChannelRead) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
      return;
    }

    api.listChannels(activeServerId).then((chs) => {
      setChannels(chs);
      const firstText = chs.find((c: api.ChannelRead) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
    }).catch(() => {
      const mockChs = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChs);
      const firstText = mockChs.find((c: api.ChannelRead) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
    });
  }, [activeServerId, usingMockData]);

  // Join channel when it changes
  useEffect(() => {
    if (!activeChannelId) return;

    if (usingMockData) {
      setMessages(MOCK_MESSAGES.filter((m) => m.channel_id === activeChannelId));
      return;
    }

    setMessages([]);
    const handleMessage = (msg: MessagePayload) => {
      setMessages((prev) => [...prev, msg]);
    };

    try {
      socket.joinChannel(activeChannelId, handleMessage);
    } catch {
      setMessages(MOCK_MESSAGES.filter((m) => m.channel_id === activeChannelId));
    }

    return () => {
      try { socket.leaveChannel(activeChannelId); } catch { /* noop */ }
    };
  }, [activeChannelId, usingMockData]);

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

  const activeServer = servers.find((s: api.ServerRead) => s.id === activeServerId);
  const activeChannel = channels.find((c: api.ChannelRead) => c.id === activeChannelId);

  const members = usingMockData
    ? MOCK_MEMBERS
    : [{ id: currentUser.id, username: currentUser.username, display_name: currentUser.display_name, status: "online" as const }];

  return (
    <div className="app-layout">
      <div className="titlebar-drag" />

      <ServerList
        servers={servers}
        activeServerId={activeServerId}
        onSelect={setActiveServerId}
        onAdd={() => setShowAddServer(true)}
      />

      {activeServer && (
        <ChannelList
          serverName={activeServer.name}
          channels={channels}
          activeChannelId={activeChannelId}
          currentUser={currentUser}
          onSelect={setActiveChannelId}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {activeChannel ? (
          <>
            <ChatView
              channelName={activeChannel.name}
              channelTopic={activeChannel.topic}
              messages={messages}
            />
            <div style={{ padding: "0 16px 16px", background: "#354E4B" }}>
              <MessageInput
                channelId={activeChannel.id}
                channelName={activeChannel.name}
                onMessageSent={() => {}}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#354E4B",
              color: "#656255",
              fontSize: 16,
            }}
          >
            {servers.length === 0
              ? "Create a server to get started"
              : "Select a channel"}
          </div>
        )}
      </div>

      {activeServer && (
        <MemberList members={members} />
      )}

      <Modal
        title="Create Server"
        visible={showAddServer}
        onOk={handleCreateServer}
        onCancel={() => setShowAddServer(false)}
        okText="Create"
        style={{ backgroundColor: "#354E4B" }}
      >
        <Input
          value={newServerName}
          onChange={setNewServerName}
          placeholder="Server name"
          onKeyDown={(e) => e.key === "Enter" && handleCreateServer()}
          autoFocus
        />
      </Modal>
    </div>
  );
};
