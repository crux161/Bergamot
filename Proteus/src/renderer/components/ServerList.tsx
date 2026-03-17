import React from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { ServerRead } from "../services/api";

interface Props {
  servers: ServerRead[];
  activeServerId: string | null;
  dmMode?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDmHome?: () => void;
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
  onSelect,
  onAdd,
  onDmHome,
}) => {
  return (
    <div className="server-list">
      {/* Home / Direct Messages button */}
      <Tooltip content="Direct Messages" position="right">
        <div
          className={`server-list__item server-list__home ${dmMode ? "server-list__item--active" : ""}`}
          onClick={onDmHome}
        >
          <PhIcon name="chats-circle" size={24} weight="fill" />
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
    </div>
  );
};
