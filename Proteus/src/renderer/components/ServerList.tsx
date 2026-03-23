import React from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { ServerRead } from "../services/api";

interface Props {
  servers: ServerRead[];
  activeServerId: string | null;
  dmMode?: boolean;
  activeUtility?: "dm" | "notifications" | "favorites" | "bookmarks" | "mentions" | "you" | null;
  notificationCount?: number;
  favoriteCount?: number;
  mentionCount?: number;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDmHome?: () => void;
  onNotifications?: () => void;
  onFavorites?: () => void;
  onBookmarks?: () => void;
  onMentions?: () => void;
  onYou?: () => void;
}

function serverInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const ServerList: React.FC<Props> = ({
  servers,
  activeServerId,
  dmMode = false,
  activeUtility = null,
  notificationCount = 0,
  favoriteCount = 0,
  mentionCount = 0,
  onSelect,
  onAdd,
  onDmHome,
  onNotifications,
  onFavorites,
  onBookmarks,
  onMentions,
  onYou,
}) => {
  return (
    <div className="server-list">
      {/* Home / Direct Messages button */}
      <Tooltip content="Direct Messages" position="right">
        <div
          className={`server-list__item server-list__home ${activeUtility === "dm" || dmMode ? "server-list__item--active" : ""}`}
          onClick={onDmHome}
        >
          <PhIcon name="chats-circle" size={24} weight="fill" />
        </div>
      </Tooltip>

      <Tooltip content="Notifications" position="right">
        <div
          className={`server-list__item server-list__utility ${activeUtility === "notifications" ? "server-list__item--active" : ""}`}
          onClick={onNotifications}
        >
          <PhIcon name="bell" size={20} />
          {notificationCount > 0 && (
            <span className="server-list__badge">{notificationCount > 9 ? "9+" : notificationCount}</span>
          )}
        </div>
      </Tooltip>

      <Tooltip content="Mentions" position="right">
        <div
          className={`server-list__item server-list__utility ${activeUtility === "mentions" ? "server-list__item--active" : ""}`}
          onClick={onMentions}
        >
          <PhIcon name="at" size={20} />
          {mentionCount > 0 && (
            <span className="server-list__badge">{mentionCount > 9 ? "9+" : mentionCount}</span>
          )}
        </div>
      </Tooltip>

      <Tooltip content="Bookmarks" position="right">
        <div
          className={`server-list__item server-list__utility ${activeUtility === "bookmarks" ? "server-list__item--active" : ""}`}
          onClick={onBookmarks}
        >
          <PhIcon name="bookmark-simple" size={20} weight={activeUtility === "bookmarks" ? "fill" : "regular"} />
        </div>
      </Tooltip>

      <Tooltip content="Favorites" position="right">
        <div
          className={`server-list__item server-list__utility ${activeUtility === "favorites" ? "server-list__item--active" : ""}`}
          onClick={onFavorites}
        >
          <PhIcon name="star" size={20} weight={activeUtility === "favorites" ? "fill" : "regular"} />
          {favoriteCount > 0 && (
            <span className="server-list__badge">{favoriteCount > 9 ? "9+" : favoriteCount}</span>
          )}
        </div>
      </Tooltip>

      <div className="server-list__divider" />

      {servers.map((s) => (
        <Tooltip key={s.id} content={s.name} position="right">
          <div
            className={`server-list__item ${
              !dmMode && s.id === activeServerId ? "server-list__item--active" : ""
            }`}
            onClick={() => onSelect(s.id)}
          >
            {serverInitials(s.name)}
          </div>
        </Tooltip>
      ))}

      <div className="server-list__divider" />

      <Tooltip content="Add Server" position="right">
        <div
          className="server-list__item server-list__add"
          onClick={onAdd}
        >
          <PhIcon name="plus" size={20} />
        </div>
      </Tooltip>

      <div className="server-list__spacer" />

      <Tooltip content="Profile" position="right">
        <div
          className={`server-list__item server-list__utility ${activeUtility === "you" ? "server-list__item--active" : ""}`}
          onClick={onYou}
        >
          <PhIcon name="user-circle" size={22} weight={activeUtility === "you" ? "fill" : "regular"} />
        </div>
      </Tooltip>
    </div>
  );
};
