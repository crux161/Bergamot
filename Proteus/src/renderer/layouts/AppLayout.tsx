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

  // Connect to Hermes on mount
  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  // Load servers
  useEffect(() => {
    api.listServers().then((s) => {
      setServers(s);
      if (s.length > 0 && !activeServerId) {
        setActiveServerId(s[0].id);
      }
    });
  }, []);

  // Load channels when server changes
  useEffect(() => {
    if (!activeServerId) return;
    setChannels([]);
    setActiveChannelId(null);
    setMessages([]);

    api.listChannels(activeServerId).then((chs) => {
      setChannels(chs);
      const firstText = chs.find((c) => c.channel_type === "text");
      if (firstText) setActiveChannelId(firstText.id);
    });
  }, [activeServerId]);

  // Join channel when it changes
  useEffect(() => {
    if (!activeChannelId) return;
    setMessages([]);

    const handleMessage = (msg: MessagePayload) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.joinChannel(activeChannelId, handleMessage);

    return () => {
      socket.leaveChannel(activeChannelId);
    };
  }, [activeChannelId]);

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

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);

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
        <MemberList
          members={[
            {
              id: currentUser.id,
              username: currentUser.username,
              display_name: currentUser.display_name,
              status: "online",
            },
          ]}
        />
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
