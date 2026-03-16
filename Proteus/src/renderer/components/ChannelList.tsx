import React, { useState, useCallback, useEffect } from "react";
import { PhIcon } from "./PhIcon";
import type { ChannelRead, UserRead } from "../services/api";
import { getConfiguredServerUrl } from "../services/api";
import { Avatar, Modal, Toast, Tooltip } from "@douyinfe/semi-ui";

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
}) => {
  const [contextMenu, setContextMenu] = useState<ChannelContextMenuState | null>(null);
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
          style={{ color: "#80848e", flexShrink: 0, opacity: 0.6 }}
        />
      )}
    </div>
  );

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
                style={{ backgroundColor: "#3d5d42", color: "#e0e1e5" }}
              >
                {currentUser.username[0].toUpperCase()}
              </Avatar>
            )}
            <span
              className={`channel-sidebar__user-status channel-sidebar__user-status--${currentUser.status || "online"}`}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e1e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser.display_name || currentUser.username}
            </div>
            <div style={{ fontSize: 11, color: "#80848e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser.status_message || (currentUser.status === "dnd" ? "Do Not Disturb" : currentUser.status === "idle" ? "Idle" : "Online")}
            </div>
          </div>
          {onOpenSettings && (
            <Tooltip content="User Settings" position="top">
              <PhIcon
                name="gear"
                size={16}
                style={{ cursor: "pointer", color: "#80848e", flexShrink: 0 }}
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
