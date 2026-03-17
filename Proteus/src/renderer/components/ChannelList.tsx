import React, { useState, useCallback, useEffect } from "react";
import { PhIcon } from "./PhIcon";
import type { ChannelRead, UserRead } from "../services/api";
import { getConfiguredServerUrl } from "../services/api";
import { Avatar, Modal, Toast, Tooltip } from "@douyinfe/semi-ui";

// ── DM Conversation type ──

export interface DmConversation {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  lastMessage?: string;
  unreadCount?: number;
}

interface ChannelContextMenuState {
  x: number;
  y: number;
  channelId: string;
  channelName: string;
}

interface Props {
  serverName: string;
  serverId: string;
  channels: ChannelRead[];
  activeChannelId: string | null;
  currentUser: UserRead | null;
  onSelect: (id: string) => void;
  onAddChannel?: () => void;
  onOpenSettings?: () => void;
  onOpenServerSettings?: () => void;
  onDeleteChannel?: (channelId: string) => void;
  canManageChannels?: boolean;
  canOpenServerSettings?: boolean;
  // DM mode
  dmMode?: boolean;
  dmConversations?: DmConversation[];
  activeDmId?: string | null;
  onSelectDm?: (id: string) => void;
  onNewDm?: () => void;
  // Voice
  voiceConnected?: boolean;
  voiceChannelName?: string;
  onDisconnectVoice?: () => void;
}

export const ChannelList: React.FC<Props> = ({
  serverName,
  serverId,
  channels,
  activeChannelId,
  currentUser,
  onSelect,
  onAddChannel,
  onOpenSettings,
  onOpenServerSettings,
  onDeleteChannel,
  canManageChannels = false,
  canOpenServerSettings = false,
  dmMode = false,
  dmConversations = [],
  activeDmId,
  onSelectDm,
  onNewDm,
  voiceConnected = false,
  voiceChannelName,
  onDisconnectVoice,
}) => {
  const [contextMenu, setContextMenu] = useState<ChannelContextMenuState | null>(null);
  const [dmSearch, setDmSearch] = useState("");
  const textChannels = channels.filter((c) => c.channel_type === "text");
  const voiceChannels = channels.filter((c) => c.channel_type === "voice");

  // Close context menu on click anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const handleChannelContextMenu = useCallback(
    (e: React.MouseEvent, ch: ChannelRead) => {
      if (!canManageChannels) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, channelId: ch.id, channelName: ch.name });
    },
    [canManageChannels]
  );

  const handleDeleteChannel = useCallback(() => {
    if (!contextMenu || !onDeleteChannel) return;
    const { channelId, channelName } = contextMenu;
    setContextMenu(null);
    Modal.confirm({
      title: `Delete #${channelName}?`,
      content: "This will permanently delete the channel and all its messages. This cannot be undone.",
      okText: "Delete",
      cancelText: "Cancel",
      okButtonProps: { type: "danger" } as any,
      onOk: () => onDeleteChannel(channelId),
    });
  }, [contextMenu, onDeleteChannel]);

  const renderChannel = (ch: ChannelRead, icon: React.ReactNode) => (
    <div
      key={ch.id}
      className={`channel-sidebar__item ${ch.id === activeChannelId ? "channel-sidebar__item--active" : ""}`}
      onClick={() => onSelect(ch.id)}
      onContextMenu={(e) => handleChannelContextMenu(e, ch)}
    >
      {icon}
      <span style={{ flex: 1 }}>{ch.name}</span>
      {canManageChannels && ch.id === activeChannelId && (
        <PhIcon
          name="gear"
          size={12}
          className="channel-sidebar__item__gear"
          style={{ color: "var(--text-muted)", flexShrink: 0, opacity: 0.6 }}
        />
      )}
    </div>
  );

  // ── DM Mode rendering ──

  const filteredDms = dmSearch.trim()
    ? dmConversations.filter((dm) =>
        dm.displayName.toLowerCase().includes(dmSearch.toLowerCase()) ||
        dm.username.toLowerCase().includes(dmSearch.toLowerCase())
      )
    : dmConversations;

  const renderDmItem = (dm: DmConversation) => {
    const avatarUrl = dm.avatarUrl && dm.avatarUrl.startsWith("/")
      ? `${getConfiguredServerUrl()}${dm.avatarUrl}`
      : dm.avatarUrl;

    return (
      <div
        key={dm.id}
        className={`channel-sidebar__dm-item ${dm.id === activeDmId ? "channel-sidebar__dm-item--active" : ""}`}
        onClick={() => onSelectDm?.(dm.id)}
      >
        <div className="channel-sidebar__dm-avatar-wrap">
          {avatarUrl ? (
            <img className="channel-sidebar__dm-avatar" src={avatarUrl} alt="" />
          ) : (
            <div className="channel-sidebar__dm-avatar channel-sidebar__dm-avatar--fallback">
              {dm.displayName[0].toUpperCase()}
            </div>
          )}
          <span className={`channel-sidebar__dm-status channel-sidebar__dm-status--${dm.status}`} />
        </div>
        <div className="channel-sidebar__dm-info">
          <div className="channel-sidebar__dm-name">{dm.displayName}</div>
          {dm.lastMessage && (
            <div className="channel-sidebar__dm-last">{dm.lastMessage}</div>
          )}
        </div>
        {dm.unreadCount && dm.unreadCount > 0 && (
          <div className="channel-sidebar__dm-badge">{dm.unreadCount}</div>
        )}
      </div>
    );
  };

  // ── DM sidebar layout ──
  if (dmMode) {
    return (
      <div className="channel-sidebar">
        {/* Search bar */}
        <div className="channel-sidebar__dm-search">
          <input
            type="text"
            className="channel-sidebar__dm-search-input"
            placeholder="Find or start a conversation"
            value={dmSearch}
            onChange={(e) => setDmSearch(e.target.value)}
          />
        </div>

        {/* Navigation items */}
        <div className="channel-sidebar__dm-nav">
          <div className="channel-sidebar__dm-nav-item channel-sidebar__dm-nav-item--active">
            <PhIcon name="users" size={18} />
            <span>Friends</span>
          </div>
          <div className="channel-sidebar__dm-nav-item">
            <PhIcon name="storefront" size={18} />
            <span>Shop</span>
          </div>
        </div>

        {/* DM header */}
        <div className="channel-sidebar__dm-header">
          <span>Direct Messages</span>
          <Tooltip content="New DM" position="top">
            <PhIcon
              name="plus"
              size={14}
              style={{ cursor: "pointer", opacity: 0.7 }}
              onClick={onNewDm}
            />
          </Tooltip>
        </div>

        {/* DM list */}
        <div className="channel-sidebar__list">
          {filteredDms.map(renderDmItem)}
          {filteredDms.length === 0 && (
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              {dmSearch ? "No conversations found" : "No direct messages yet"}
            </div>
          )}
        </div>

        {/* Voice connection bar */}
        {voiceConnected && (
          <div className="channel-sidebar__voice-bar">
            <div className="channel-sidebar__voice-bar-info">
              <PhIcon name="signal-high" size={16} style={{ color: "var(--status-positive, #23a55a)" }} />
              <div>
                <div className="channel-sidebar__voice-bar-status">Voice Connected</div>
                <div className="channel-sidebar__voice-bar-channel">{voiceChannelName || "Direct Call"}</div>
              </div>
            </div>
            <Tooltip content="Disconnect" position="top">
              <PhIcon
                name="phone-disconnect"
                size={18}
                style={{ cursor: "pointer", color: "var(--text-muted)" }}
                onClick={onDisconnectVoice}
              />
            </Tooltip>
          </div>
        )}

        {/* User panel */}
        {currentUser && (
          <div className="channel-sidebar__user-panel">
            <div className="channel-sidebar__user-avatar-wrap">
              {currentUser.avatar_url ? (
                <Avatar
                  size="small"
                  src={currentUser.avatar_url.startsWith("/")
                    ? `${getConfiguredServerUrl()}${currentUser.avatar_url}`
                    : currentUser.avatar_url
                  }
                />
              ) : (
                <Avatar
                  size="small"
                  style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}
                >
                  {currentUser.username[0].toUpperCase()}
                </Avatar>
              )}
              <span
                className={`channel-sidebar__user-status channel-sidebar__user-status--${currentUser.status || "online"}`}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--header-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.display_name || currentUser.username}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.status_message || (currentUser.status === "dnd" ? "Do Not Disturb" : currentUser.status === "idle" ? "Idle" : "Online")}
              </div>
            </div>
            {onOpenSettings && (
              <Tooltip content="User Settings" position="top">
                <PhIcon
                  name="gear"
                  size={16}
                  style={{ cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                  onClick={onOpenSettings}
                />
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Server channel sidebar layout ──
  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar__header">
        <span style={{ flex: 1 }}>{serverName}</span>
        {canOpenServerSettings && onOpenServerSettings && (
          <Tooltip content="Server Settings" position="bottom">
            <PhIcon
              name="gear"
              size={14}
              style={{ cursor: "pointer", opacity: 0.7, marginRight: 4 }}
              onClick={onOpenServerSettings}
            />
          </Tooltip>
        )}
        {canManageChannels && onAddChannel && (
          <Tooltip content="Create Channel" position="bottom">
            <PhIcon
              name="plus"
              size={14}
              style={{ cursor: "pointer", opacity: 0.7 }}
              onClick={onAddChannel}
            />
          </Tooltip>
        )}
      </div>

      <div className="channel-sidebar__list">
        {textChannels.length > 0 && (
          <>
            <div className="channel-sidebar__category">Text Channels</div>
            {textChannels.map((ch) =>
              renderChannel(ch, <PhIcon name="hash" className="channel-sidebar__item__icon" />)
            )}
          </>
        )}

        {voiceChannels.length > 0 && (
          <>
            <div className="channel-sidebar__category">Voice Channels</div>
            {voiceChannels.map((ch) =>
              renderChannel(ch, <PhIcon name="speaker-high" className="channel-sidebar__item__icon" />)
            )}
          </>
        )}
      </div>

      {/* Voice connection bar */}
      {voiceConnected && (
        <div className="channel-sidebar__voice-bar">
          <div className="channel-sidebar__voice-bar-info">
            <PhIcon name="signal-high" size={16} style={{ color: "var(--status-positive, #23a55a)" }} />
            <div>
              <div className="channel-sidebar__voice-bar-status">Voice Connected</div>
              <div className="channel-sidebar__voice-bar-channel">{voiceChannelName || "General"}</div>
            </div>
          </div>
          <Tooltip content="Disconnect" position="top">
            <PhIcon
              name="phone-disconnect"
              size={18}
              style={{ cursor: "pointer", color: "var(--text-muted)" }}
              onClick={onDisconnectVoice}
            />
          </Tooltip>
        </div>
      )}

      {currentUser && (
        <div className="channel-sidebar__user-panel">
          <div className="channel-sidebar__user-avatar-wrap">
            {currentUser.avatar_url ? (
              <Avatar
                size="small"
                src={currentUser.avatar_url.startsWith("/")
                  ? `${getConfiguredServerUrl()}${currentUser.avatar_url}`
                  : currentUser.avatar_url
                }
              />
            ) : (
              <Avatar
                size="small"
                style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}
              >
                {currentUser.username[0].toUpperCase()}
              </Avatar>
            )}
            <span
              className={`channel-sidebar__user-status channel-sidebar__user-status--${currentUser.status || "online"}`}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--header-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser.display_name || currentUser.username}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser.status_message || (currentUser.status === "dnd" ? "Do Not Disturb" : currentUser.status === "idle" ? "Idle" : "Online")}
            </div>
          </div>
          {onOpenSettings && (
            <Tooltip content="User Settings" position="top">
              <PhIcon
                name="gear"
                size={16}
                style={{ cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                onClick={onOpenSettings}
              />
            </Tooltip>
          )}
        </div>
      )}

      {/* Channel context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div
            className="context-menu__item context-menu__item--danger"
            onClick={handleDeleteChannel}
          >
            Delete Channel
          </div>
        </div>
      )}
    </div>
  );
};
