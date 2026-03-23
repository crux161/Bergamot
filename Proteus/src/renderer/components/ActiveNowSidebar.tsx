import React from "react";
import styles from "./ActiveNowSidebar.module.css";
import { PhIcon } from "./PhIcon";
import { getConfiguredServerUrl } from "../services/api";

// ── Types ──

export interface ActiveFriend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  statusMessage?: string | null;
}

export interface VoiceActivity {
  channelId: string;
  channelName: string;
  guildId?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
  isStreaming?: boolean;
  participants: Array<{
    id: string;
    username: string;
    avatarUrl: string | null;
  }>;
}

interface Props {
  /** Online friends / DM contacts to show in the sidebar */
  activeFriends: ActiveFriend[];
  /** Voice channel activities from friends (requires voice state backend) */
  voiceActivities?: VoiceActivity[];
  /** Called when user clicks on a friend entry */
  onSelectFriend?: (userId: string) => void;
  /** Called when user clicks join on a voice activity */
  onJoinVoice?: (channelId: string) => void;
}

function resolveAvatar(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${getConfiguredServerUrl()}${url}` : url;
}

const MAX_VISIBLE_AVATARS = 4;

// ── Avatar Stack ──

const AvatarStack: React.FC<{
  participants: VoiceActivity["participants"];
}> = ({ participants }) => {
  const visible = participants.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = participants.length - MAX_VISIBLE_AVATARS;

  return (
    <div className={styles.participantsAvatarStack} role="group">
      {visible.map((p) => {
        const src = resolveAvatar(p.avatarUrl);
        return (
          <div key={p.id} className={styles.participantAvatar} title={p.username}>
            {src ? (
              <img src={src} alt={p.username} className={styles.participantAvatarImg} />
            ) : (
              p.username[0]?.toUpperCase() || "?"
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className={styles.participantOverflow}>+{overflow}</div>
      )}
    </div>
  );
};

// ── Voice Activity Card ──

const VoiceActivityCard: React.FC<{
  activity: VoiceActivity;
  onJoin?: () => void;
}> = ({ activity, onJoin }) => {
  return (
    <div className={styles.card}>
      <div className={styles.headerContextGroup}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <span
              className={`${styles.activityLabel} ${activity.isStreaming ? styles.streamingLabel : ""}`}
            >
              {activity.isStreaming ? "Streaming" : "In Voice"}
            </span>
          </div>
          <AvatarStack participants={activity.participants} />
        </div>

        <button className={styles.contextButton} title={activity.channelName}>
          {activity.guildName ? (
            <>
              {activity.guildIconUrl ? (
                <div className={styles.contextGuildIcon}>
                  <img
                    src={resolveAvatar(activity.guildIconUrl) || ""}
                    alt={activity.guildName}
                    className={styles.contextGuildIconImg}
                  />
                </div>
              ) : (
                <div className={styles.contextGuildIcon}>
                  {activity.guildName[0]?.toUpperCase()}
                </div>
              )}
              <span className={styles.contextChevron}>
                <PhIcon name="caret-right" size={10} />
              </span>
            </>
          ) : null}
          <span className={styles.contextIcon}>
            <PhIcon name="speaker-high" size={14} />
          </span>
          <span className={styles.contextChannelName}>{activity.channelName}</span>
        </button>
      </div>

      <div className={styles.actionRow}>
        <button className={styles.actionButton} onClick={onJoin}>
          <PhIcon name="phone" size={16} />
          Join Voice
        </button>
      </div>
    </div>
  );
};

// ── Friend Entry ──

const FriendEntry: React.FC<{
  friend: ActiveFriend;
  onClick?: () => void;
}> = ({ friend, onClick }) => {
  const src = resolveAvatar(friend.avatarUrl);

  return (
    <div className={styles.friendCard} onClick={onClick}>
      <div className={styles.friendAvatar}>
        {src ? (
          <img src={src} alt={friend.username} className={styles.friendAvatarImg} />
        ) : (
          friend.username[0]?.toUpperCase() || "?"
        )}
        <div
          className={styles.friendAvatarStatus}
          data-status={friend.status}
          style={{
            background:
              friend.status === "online"
                ? "var(--status-positive, #23a55a)"
                : friend.status === "idle"
                  ? "var(--status-warning, #f0b232)"
                  : friend.status === "dnd"
                    ? "var(--status-danger, #f23f43)"
                    : "var(--text-muted)",
          }}
        />
      </div>
      <div className={styles.friendInfo}>
        <div className={styles.friendName}>
          {friend.displayName || friend.username}
        </div>
        {friend.statusMessage ? (
          <div className={styles.friendStatus}>{friend.statusMessage}</div>
        ) : (
          <div className={styles.friendStatus}>
            {friend.status === "online"
              ? "Online"
              : friend.status === "idle"
                ? "Idle"
                : friend.status === "dnd"
                  ? "Do Not Disturb"
                  : "Offline"}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Empty State ──

const EmptyState: React.FC = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>
      <PhIcon name="speaker-none" size={48} />
    </div>
    <div className={styles.emptyTitle}>It's quiet for now...</div>
    <div className={styles.emptyDescription}>
      When friends are active in voice channels, their activity will appear here.
    </div>
  </div>
);

// ── Main Sidebar ──

export const ActiveNowSidebar: React.FC<Props> = ({
  activeFriends,
  voiceActivities = [],
  onSelectFriend,
  onJoinVoice,
}) => {
  const onlineFriends = activeFriends.filter((f) => f.status !== "offline");
  const hasVoice = voiceActivities.length > 0;
  const hasOnline = onlineFriends.length > 0;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Active Now</span>
      </div>

      {!hasVoice && !hasOnline ? (
        <EmptyState />
      ) : (
        <div className={styles.content}>
          {hasVoice && (
            <>
              <div className={styles.sectionLabel}>
                Voice — {voiceActivities.length}
              </div>
              {voiceActivities.map((activity) => (
                <VoiceActivityCard
                  key={activity.channelId}
                  activity={activity}
                  onJoin={onJoinVoice ? () => onJoinVoice(activity.channelId) : undefined}
                />
              ))}
            </>
          )}

          {hasOnline && (
            <>
              <div className={styles.sectionLabel}>
                Online — {onlineFriends.length}
              </div>
              {onlineFriends.map((friend) => (
                <FriendEntry
                  key={friend.id}
                  friend={friend}
                  onClick={onSelectFriend ? () => onSelectFriend(friend.id) : undefined}
                />
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  );
};
