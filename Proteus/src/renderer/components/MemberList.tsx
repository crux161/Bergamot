import React from "react";

interface Member {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  status_message?: string | null;
}

interface Props {
  members: Member[];
}

const ROOT_URL = ((window as any).__BERGAMOT_API_URL__ || "http://localhost:8000/api/v1").replace(/\/api\/v1$/, "");

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${ROOT_URL}${url}` : url;
}

export const MemberList: React.FC<Props> = ({ members }) => {
  const online = members.filter((m) => m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  const renderMember = (m: Member) => {
    const avatarUrl = resolveUrl(m.avatar_url);
    return (
      <div className="member-sidebar__item" key={m.id}>
        {avatarUrl ? (
          <img className="member-sidebar__avatar member-sidebar__avatar--img" src={avatarUrl} alt="" />
        ) : (
          <div className="member-sidebar__avatar">
            {(m.display_name || m.username)[0].toUpperCase()}
          </div>
        )}
        <div className={`member-sidebar__status member-sidebar__status--${m.status}`} />
        <div className="member-sidebar__info">
          <div className="member-sidebar__name">
            {m.display_name || m.username}
          </div>
          {m.status_message && (
            <div className="member-sidebar__status-msg">{m.status_message}</div>
          )}
        </div>
      </div>
    );
  };

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
