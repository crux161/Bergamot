import React from "react";
import { IconHash, IconVolume1 } from "@douyinfe/semi-icons";
import type { ChannelRead, UserRead } from "../services/api";
import { Avatar } from "@douyinfe/semi-ui";

interface Props {
  serverName: string;
  channels: ChannelRead[];
  activeChannelId: string | null;
  currentUser: UserRead | null;
  onSelect: (id: string) => void;
}

export const ChannelList: React.FC<Props> = ({
  serverName,
  channels,
  activeChannelId,
  currentUser,
  onSelect,
}) => {
  const textChannels = channels.filter((c) => c.channel_type === "text");
  const voiceChannels = channels.filter((c) => c.channel_type === "voice");

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar__header">{serverName}</div>

      <div className="channel-sidebar__list">
        {textChannels.length > 0 && (
          <>
            <div className="channel-sidebar__category">Text Channels</div>
            {textChannels.map((ch) => (
              <div
                key={ch.id}
                className={`channel-sidebar__item ${
                  ch.id === activeChannelId
                    ? "channel-sidebar__item--active"
                    : ""
                }`}
                onClick={() => onSelect(ch.id)}
              >
                <IconHash className="channel-sidebar__item__icon" />
                {ch.name}
              </div>
            ))}
          </>
        )}

        {voiceChannels.length > 0 && (
          <>
            <div className="channel-sidebar__category">Voice Channels</div>
            {voiceChannels.map((ch) => (
              <div
                key={ch.id}
                className={`channel-sidebar__item ${
                  ch.id === activeChannelId
                    ? "channel-sidebar__item--active"
                    : ""
                }`}
                onClick={() => onSelect(ch.id)}
              >
                <IconVolume1 className="channel-sidebar__item__icon" />
                {ch.name}
              </div>
            ))}
          </>
        )}
      </div>

      {currentUser && (
        <div className="channel-sidebar__user-panel">
          <Avatar
            size="small"
            style={{ backgroundColor: "#3d5d42", color: "#a5ba93" }}
          >
            {currentUser.username[0].toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#a5ba93" }}>
              {currentUser.display_name || currentUser.username}
            </div>
            <div style={{ fontSize: 11, color: "#656255" }}>Online</div>
          </div>
        </div>
      )}
    </div>
  );
};
