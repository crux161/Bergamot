import React from "react";
import { IconPlus } from "@douyinfe/semi-icons";
import { Tooltip } from "@douyinfe/semi-ui";
import type { ServerRead } from "../services/api";

interface Props {
  servers: ServerRead[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
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
  onSelect,
  onAdd,
}) => {
  return (
    <div className="server-list">
      {servers.map((s) => (
        <Tooltip key={s.id} content={s.name} position="right">
          <div
            className={`server-list__item ${
              s.id === activeServerId ? "server-list__item--active" : ""
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
          <IconPlus size="large" />
        </div>
      </Tooltip>
    </div>
  );
};
