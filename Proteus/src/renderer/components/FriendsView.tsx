import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button, Input, Toast, Tabs, TabPane, Modal } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";

interface Props {
  currentUserId: string;
  onOpenDm?: (userId: string) => void;
  onOpenServer?: (serverId: string) => void;
}

type FriendTab = "online" | "all" | "pending" | "blocked" | "add";

/* ── Profile Card Popout ─────────────────────────────────────────── */

interface ProfileCardProps {
  friend: api.FriendshipRead;
  position: { top: number; left: number };
  onClose: () => void;
  onOpenDm?: (userId: string) => void;
  onOpenServer?: (serverId: string) => void;
  onRemove: (userId: string) => void;
  onBlock: (userId: string) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  friend,
  position,
  onClose,
  onOpenDm,
  onOpenServer,
  onRemove,
  onBlock,
}) => {
  const [mutualServers, setMutualServers] = useState<api.MutualServerRead[]>([]);
  const [loadingMutuals, setLoadingMutuals] = useState(true);
  const [note, setNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMutualServers(friend.peer_id).then((servers) => {
      setMutualServers(servers);
      setLoadingMutuals(false);
    }).catch(() => setLoadingMutuals(false));

    api.getUserNote(friend.peer_id).then((n) => {
      setNote(n.content);
      setNoteDraft(n.content);
    }).catch(() => {});
  }, [friend.peer_id]);

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const updated = await api.setUserNote(friend.peer_id, noteDraft);
      setNote(updated.content);
      setEditingNote(false);
    } catch { /* ignore */ }
    finally { setSavingNote(false); }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const friendSince = new Date(friend.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const bannerStyle: React.CSSProperties = friend.peer_banner_url
    ? { backgroundImage: `url(${friend.peer_banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, var(--accent-color, #5865f2) 0%, #7289da 100%)" };

  return (
    <div className="profile-card-popout" ref={cardRef} style={{ top: position.top, left: position.left }}>
      <div className="profile-card-popout__banner" style={bannerStyle} />
      <div className="profile-card-popout__avatar-wrapper">
        {friend.peer_avatar_url ? (
          <img src={friend.peer_avatar_url} alt="" className="profile-card-popout__avatar" />
        ) : (
          <div className="profile-card-popout__avatar profile-card-popout__avatar--fallback">
            {(friend.peer_username || "?")[0].toUpperCase()}
          </div>
        )}
        <span className={`profile-card-popout__status-dot profile-card-popout__status-dot--${friend.peer_status || "offline"}`} />
      </div>
      <div className="profile-card-popout__body">
        <div className="profile-card-popout__display-name">
          {friend.peer_display_name || friend.peer_username}
        </div>
        <div className="profile-card-popout__username">{friend.peer_username}</div>

        {friend.peer_status_message && (
          <div className="profile-card-popout__custom-status">
            {friend.peer_status_message}
          </div>
        )}

        {friend.nickname && (
          <div className="profile-card-popout__nickname-note">
            Nicknamed: <strong>{friend.nickname}</strong>
          </div>
        )}

        <div className="profile-card-popout__divider" />

        <div className="profile-card-popout__section">
          <div className="profile-card-popout__section-label">Friends Since</div>
          <div className="profile-card-popout__section-value">{friendSince}</div>
        </div>

        {mutualServers.length > 0 && (
          <div className="profile-card-popout__section">
            <div className="profile-card-popout__section-label">
              Mutual Servers — {mutualServers.length}
            </div>
            <div className="profile-card-popout__mutual-list">
              {mutualServers.map((s) => (
                <div
                  key={s.id}
                  className="profile-card-popout__mutual-item"
                  onClick={() => { onOpenServer?.(s.id); onClose(); }}
                >
                  {s.icon_url ? (
                    <img src={s.icon_url} alt="" className="profile-card-popout__mutual-icon" />
                  ) : (
                    <div className="profile-card-popout__mutual-icon profile-card-popout__mutual-icon--fallback">
                      {s.name[0]}
                    </div>
                  )}
                  <span className="profile-card-popout__mutual-name">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loadingMutuals && mutualServers.length === 0 && (
          <div className="profile-card-popout__section">
            <div className="profile-card-popout__section-label">Mutual Servers</div>
            <div className="profile-card-popout__section-value profile-card-popout__section-value--muted">None</div>
          </div>
        )}

        <div className="profile-card-popout__section">
          <div className="profile-card-popout__section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Note</span>
            {!editingNote && (
              <span
                className="profile-card-popout__note-edit"
                onClick={() => { setEditingNote(true); setNoteDraft(note); }}
              >
                {note ? "Edit" : "Add"}
              </span>
            )}
          </div>
          {editingNote ? (
            <div style={{ display: "grid", gap: 6 }}>
              <textarea
                className="profile-card-popout__note-input"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write a note about this user..."
                rows={3}
                maxLength={2000}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <Button size="small" theme="solid" loading={savingNote} onClick={saveNote}>Save</Button>
                <Button size="small" theme="borderless" onClick={() => setEditingNote(false)}>Cancel</Button>
              </div>
            </div>
          ) : note ? (
            <div className="profile-card-popout__section-value">{note}</div>
          ) : (
            <div className="profile-card-popout__section-value profile-card-popout__section-value--muted">No note</div>
          )}
        </div>

        <div className="profile-card-popout__divider" />

        <div className="profile-card-popout__actions">
          <Button
            size="small"
            theme="solid"
            icon={<PhIcon name="chat-circle" size={14} />}
            onClick={() => { onOpenDm?.(friend.peer_id); onClose(); }}
          >
            Message
          </Button>
          <Button
            size="small"
            theme="borderless"
            type="danger"
            onClick={() => { onRemove(friend.peer_id); onClose(); }}
          >
            Remove
          </Button>
          <Button
            size="small"
            theme="borderless"
            type="danger"
            onClick={() => { onBlock(friend.peer_id); onClose(); }}
          >
            Block
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ── Main FriendsView ────────────────────────────────────────────── */

export const FriendsView: React.FC<Props> = ({ currentUserId, onOpenDm, onOpenServer }) => {
  const [relationships, setRelationships] = useState<api.FriendshipRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FriendTab>("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [editingPeerId, setEditingPeerId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileCard, setProfileCard] = useState<{
    friend: api.FriendshipRead;
    position: { top: number; left: number };
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "block";
    userId: string;
    username: string;
  } | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const data = await api.listFriends();
      setRelationships(data);
    } catch {
      // silently fail — empty state will show
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const friends = useMemo(
    () => relationships.filter((r) => r.relationship_type === api.RelationshipType.FRIEND),
    [relationships],
  );
  const onlineFriends = useMemo(
    () => friends.filter((r) => r.peer_status === "online" || r.peer_status === "idle" || r.peer_status === "dnd"),
    [friends],
  );
  const incoming = useMemo(
    () => relationships.filter((r) => r.relationship_type === api.RelationshipType.INCOMING_REQUEST),
    [relationships],
  );
  const outgoing = useMemo(
    () => relationships.filter((r) => r.relationship_type === api.RelationshipType.OUTGOING_REQUEST),
    [relationships],
  );
  const blocked = useMemo(
    () => relationships.filter((r) => r.relationship_type === api.RelationshipType.BLOCKED),
    [relationships],
  );

  const pendingCount = incoming.length + outgoing.length;

  const filterBySearch = (list: api.FriendshipRead[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r) =>
        r.peer_username?.toLowerCase().includes(q) ||
        r.peer_display_name?.toLowerCase().includes(q) ||
        r.nickname?.toLowerCase().includes(q),
    );
  };

  const handleAccept = async (userId: string) => {
    try {
      await api.acceptFriendRequest(userId);
      Toast.success("Friend request accepted");
      loadFriends();
    } catch (err: any) {
      Toast.error(err.message || "Failed to accept");
    }
  };

  const executeRemove = async (userId: string) => {
    try {
      await api.removeFriend(userId);
      loadFriends();
    } catch (err: any) {
      Toast.error(err.message || "Failed to remove");
    }
  };

  const executeBlock = async (userId: string) => {
    try {
      await api.blockUser(userId);
      Toast.success("User blocked");
      loadFriends();
      setActiveTab("blocked");
    } catch (err: any) {
      Toast.error(err.message || "Failed to block user");
    }
  };

  const handleRemove = (userId: string) => {
    const rel = relationships.find((r) => r.peer_id === userId);
    setConfirmAction({
      type: "remove",
      userId,
      username: rel?.peer_display_name || rel?.peer_username || "this user",
    });
  };

  const handleBlock = (userId: string) => {
    const rel = relationships.find((r) => r.peer_id === userId);
    setConfirmAction({
      type: "block",
      userId,
      username: rel?.peer_display_name || rel?.peer_username || "this user",
    });
  };

  const confirmExecute = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === "remove") {
      await executeRemove(confirmAction.userId);
    } else {
      await executeBlock(confirmAction.userId);
    }
    setConfirmAction(null);
  };

  const handleAddFriend = async () => {
    if (!addUsername.trim()) return;
    setAddLoading(true);
    try {
      await api.sendFriendRequest(addUsername.trim());
      Toast.success(`Friend request sent to ${addUsername}`);
      setAddUsername("");
      loadFriends();
    } catch (err: any) {
      Toast.error(err.message || "Failed to send request");
    } finally {
      setAddLoading(false);
    }
  };

  const displayName = (r: api.FriendshipRead) =>
    r.nickname || r.peer_display_name || r.peer_username || "Unknown";

  const beginNicknameEdit = (relationship: api.FriendshipRead) => {
    setEditingPeerId(relationship.peer_id);
    setNicknameDraft(relationship.nickname || "");
  };

  const submitNickname = async (userId: string) => {
    try {
      await api.updateFriendNickname(userId, nicknameDraft.trim() || null);
      Toast.success("Nickname updated");
      setEditingPeerId(null);
      setNicknameDraft("");
      loadFriends();
    } catch (err: any) {
      Toast.error(err.message || "Failed to update nickname");
    }
  };

  const openProfileCard = (r: api.FriendshipRead, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProfileCard({
      friend: r,
      position: { top: rect.top, left: rect.right + 8 },
    });
  };

  const statusLabel = (status: string | null) => {
    if (!status || status === "offline") return "Offline";
    if (status === "online") return "Online";
    if (status === "idle") return "Idle";
    if (status === "dnd") return "Do Not Disturb";
    return status;
  };

  const requestTimestamp = (r: api.FriendshipRead) => {
    const d = new Date(r.created_at);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderFriendRow = (r: api.FriendshipRead, actions: React.ReactNode, clickable = false) => (
    <div
      key={r.id}
      className={`friends-view__row ${clickable ? "friends-view__row--clickable" : ""}`}
      onClick={clickable ? (e) => openProfileCard(r, e) : undefined}
    >
      <div className="friends-view__avatar">
        {r.peer_avatar_url ? (
          <img src={r.peer_avatar_url} alt="" className="friends-view__avatar-img" />
        ) : (
          <div className="friends-view__avatar-fallback">
            {(r.peer_username || "?")[0].toUpperCase()}
          </div>
        )}
        <span className={`friends-view__status-dot friends-view__status-dot--${r.peer_status || "offline"}`} />
      </div>
      <div className="friends-view__info">
        <div className="friends-view__name">{displayName(r)}</div>
        <div className="friends-view__meta-row">
          <span className="friends-view__username">{r.peer_username}</span>
          {r.peer_status_message && (
            <span className="friends-view__custom-status" title={r.peer_status_message}>
              — {r.peer_status_message}
            </span>
          )}
          {!r.peer_status_message && r.peer_status && r.peer_status !== "offline" && (
            <span className="friends-view__status-label">{statusLabel(r.peer_status)}</span>
          )}
        </div>
        {editingPeerId === r.peer_id ? (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Input
              size="small"
              value={nicknameDraft}
              onChange={setNicknameDraft}
              placeholder="Friend nickname"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submitNickname(r.peer_id);
                }
              }}
            />
            <Button size="small" theme="solid" onClick={() => { void submitNickname(r.peer_id); }}>
              Save
            </Button>
            <Button size="small" theme="borderless" onClick={() => setEditingPeerId(null)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
      <div className="friends-view__actions" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  );

  const renderFriendsList = (list: api.FriendshipRead[]) => {
    const filtered = filterBySearch(list);
    if (loading) return <div className="friends-view__empty">Loading...</div>;
    if (filtered.length === 0)
      return <div className="friends-view__empty">No friends to show</div>;
    return filtered.map((r) =>
      renderFriendRow(
        r,
        <>
          <Button
            size="small"
            theme="borderless"
            icon={<PhIcon name="pencil-simple" size={16} />}
            onClick={() => beginNicknameEdit(r)}
            title="Set nickname"
          />
          <Button
            size="small"
            theme="borderless"
            icon={<PhIcon name="chat-circle" size={16} />}
            onClick={() => onOpenDm?.(r.peer_id)}
            title="Send message"
          />
          <Button
            size="small"
            theme="borderless"
            type="danger"
            icon={<PhIcon name="user-minus" size={16} />}
            onClick={() => handleRemove(r.peer_id)}
            title="Remove friend"
          />
        </>,
        true,
      ),
    );
  };

  const renderPending = () => {
    if (loading) return <div className="friends-view__empty">Loading...</div>;
    const filteredIncoming = filterBySearch(incoming);
    const filteredOutgoing = filterBySearch(outgoing);
    if (filteredIncoming.length === 0 && filteredOutgoing.length === 0)
      return (
        <div className="friends-view__empty">
          <PhIcon name="user-circle-plus" size={48} />
          <div style={{ marginTop: 8 }}>No pending requests</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Friend requests you send or receive will appear here.
          </div>
        </div>
      );
    return (
      <>
        {filteredIncoming.length > 0 && (
          <div className="friends-view__section">
            <div className="friends-view__section-title">
              Incoming — {filteredIncoming.length}
            </div>
            {filteredIncoming.map((r) =>
              renderFriendRow(
                r,
                <div className="friends-view__pending-actions">
                  <span className="friends-view__request-time">{requestTimestamp(r)}</span>
                  <Button
                    size="small"
                    theme="solid"
                    icon={<PhIcon name="check" size={16} />}
                    onClick={() => handleAccept(r.peer_id)}
                    title="Accept request"
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    theme="borderless"
                    type="danger"
                    icon={<PhIcon name="x" size={16} />}
                    onClick={() => executeRemove(r.peer_id)}
                    title="Decline request"
                  />
                </div>,
              ),
            )}
          </div>
        )}
        {filteredOutgoing.length > 0 && (
          <div className="friends-view__section">
            <div className="friends-view__section-title">
              Outgoing — {filteredOutgoing.length}
            </div>
            {filteredOutgoing.map((r) =>
              renderFriendRow(
                r,
                <div className="friends-view__pending-actions">
                  <span className="friends-view__request-time">{requestTimestamp(r)}</span>
                  <Button
                    size="small"
                    theme="borderless"
                    type="danger"
                    icon={<PhIcon name="x" size={16} />}
                    onClick={() => executeRemove(r.peer_id)}
                    title="Cancel request"
                  >
                    Cancel
                  </Button>
                </div>,
              ),
            )}
          </div>
        )}
      </>
    );
  };

  const renderBlocked = () => {
    if (loading) return <div className="friends-view__empty">Loading...</div>;
    const filtered = filterBySearch(blocked);
    if (filtered.length === 0) {
      return (
        <div className="friends-view__empty">
          <PhIcon name="shield-check" size={48} />
          <div style={{ marginTop: 8 }}>No blocked users</div>
        </div>
      );
    }
    return filtered.map((r) =>
      renderFriendRow(
        r,
        <Button
          size="small"
          theme="borderless"
          onClick={() => executeRemove(r.peer_id)}
        >
          Unblock
        </Button>,
      ),
    );
  };

  return (
    <div className="friends-view">
      <div className="friends-view__header">
        <PhIcon name="users" size={20} />
        <span className="friends-view__header-title">Friends</span>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as FriendTab); setSearchQuery(""); }}
        className="friends-view__tabs"
      >
        <TabPane
          tab={`Online — ${onlineFriends.length}`}
          itemKey="online"
        />
        <TabPane
          tab={`All — ${friends.length}`}
          itemKey="all"
        />
        <TabPane
          tab={
            <span>
              Pending
              {pendingCount > 0 && (
                <span className="friends-view__badge">{pendingCount}</span>
              )}
            </span>
          }
          itemKey="pending"
        />
        <TabPane
          tab={`Blocked — ${blocked.length}`}
          itemKey="blocked"
        />
        <TabPane
          tab={<span className="friends-view__add-tab">Add Friend</span>}
          itemKey="add"
        />
      </Tabs>

      {activeTab !== "add" && (
        <div className="friends-view__search">
          <Input
            prefix={<PhIcon name="magnifying-glass" size={14} />}
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            size="small"
          />
        </div>
      )}

      <div className="friends-view__content">
        {activeTab === "online" && renderFriendsList(onlineFriends)}
        {activeTab === "all" && renderFriendsList(friends)}
        {activeTab === "pending" && renderPending()}
        {activeTab === "blocked" && renderBlocked()}
        {activeTab === "add" && (
          <div className="friends-view__add-form">
            <div className="friends-view__add-heading">Add Friend</div>
            <div className="friends-view__add-hint">
              Enter their username to send a friend request.
            </div>
            <div className="friends-view__add-row">
              <Input
                placeholder="Username"
                value={addUsername}
                onChange={setAddUsername}
                onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                className="friends-view__add-input"
              />
              <Button
                theme="solid"
                loading={addLoading}
                disabled={!addUsername.trim()}
                onClick={handleAddFriend}
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Card Popout */}
      {profileCard && (
        <ProfileCard
          friend={profileCard.friend}
          position={profileCard.position}
          onClose={() => setProfileCard(null)}
          onOpenDm={onOpenDm}
          onOpenServer={onOpenServer}
          onRemove={handleRemove}
          onBlock={handleBlock}
        />
      )}

      {/* Confirmation Dialog */}
      <Modal
        visible={!!confirmAction}
        title={confirmAction?.type === "block" ? "Block User" : "Remove Friend"}
        onCancel={() => setConfirmAction(null)}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              theme="solid"
              type="danger"
              onClick={confirmExecute}
            >
              {confirmAction?.type === "block" ? "Block" : "Remove"}
            </Button>
          </div>
        }
        closable
        width={400}
      >
        {confirmAction?.type === "block" ? (
          <p>
            Are you sure you want to block <strong>{confirmAction.username}</strong>?
            They will not be able to message you or send friend requests.
          </p>
        ) : (
          <p>
            Are you sure you want to remove <strong>{confirmAction?.username}</strong> as a friend?
          </p>
        )}
      </Modal>
    </div>
  );
};
