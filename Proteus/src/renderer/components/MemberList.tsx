import React from "react";

interface Member {
  id: string;
  username: string;
  display_name?: string | null;
  status: "online" | "idle" | "dnd" | "offline";
}

interface Props {
  members: Member[];
}

export const MemberList: React.FC<Props> = ({ members }) => {
  const online = members.filter((m) => m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  const renderMember = (m: Member) => (
    <div className="member-sidebar__item" key={m.id}>
      <div className="member-sidebar__avatar">
        {(m.display_name || m.username)[0].toUpperCase()}
      </div>
      <div className={`member-sidebar__status member-sidebar__status--${m.status}`} />
      <div className="member-sidebar__name">
        {m.display_name || m.username}
      </div>
    </div>
  );

  return (
    <div className="member-sidebar">
      {online.length > 0 && (
        <>
          <div className="member-sidebar__header">
            Online — {online.length}
          </div>
          {online.map(renderMember)}
        </>
      )}
      {offline.length > 0 && (
        <>
          <div className="member-sidebar__header">
            Offline — {offline.length}
          </div>
          {offline.map(renderMember)}
        </>
      )}
    </div>
  );
};
