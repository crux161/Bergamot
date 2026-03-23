import React, { useEffect, useState, useCallback } from "react";
import type { UserRead, ServerRead } from "../services/api";
import * as api from "../services/api";
import { PhIcon } from "./PhIcon";

interface Props {
  currentUser: UserRead;
  onEditSettings: () => void;
  onOpenNotifications: () => void;
  onOpenFavorites: () => void;
  onOpenServer: (serverId: string) => void;
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export const ProfileView: React.FC<Props> = ({
  currentUser,
  onEditSettings,
  onOpenNotifications,
  onOpenFavorites,
  onOpenServer,
}) => {
  const [servers, setServers] = useState<ServerRead[]>([]);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    api.listServers().then(setServers).catch(() => {});
    api.listFriends().then((friends) => {
      setFriendCount(friends.filter((f) => f.relationship_type === 1).length);
    }).catch(() => {});
  }, []);

  return (
    <div className="profile-view">
      <div className="profile-view__banner" />
      <div className="profile-view__card">
        <div className="profile-view__avatar-section">
          {currentUser.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" className="profile-view__avatar" />
          ) : (
            <div className="profile-view__avatar profile-view__avatar--fallback">
              {(currentUser.display_name || currentUser.username)[0].toUpperCase()}
            </div>
          )}
          <div className={`profile-view__status-dot profile-view__status-dot--${currentUser.status || "online"}`} />
        </div>
        <div className="profile-view__identity">
          <h2 className="profile-view__display-name">
            {currentUser.display_name || currentUser.username}
          </h2>
          <span className="profile-view__username">@{currentUser.username}</span>
          {currentUser.status_message && (
            <span className="profile-view__status-message">{currentUser.status_message}</span>
          )}
        </div>
        <button className="profile-view__edit-btn" onClick={onEditSettings}>
          <PhIcon name="pencil-simple" size={16} />
          Edit Profile
        </button>
      </div>

      <div className="profile-view__stats">
        <div className="profile-view__stat">
          <span className="profile-view__stat-value">{servers.length}</span>
          <span className="profile-view__stat-label">Servers</span>
        </div>
        <div className="profile-view__stat">
          <span className="profile-view__stat-value">{friendCount}</span>
          <span className="profile-view__stat-label">Friends</span>
        </div>
        <div className="profile-view__stat">
          <span className="profile-view__stat-value">{formatJoinDate(currentUser.created_at)}</span>
          <span className="profile-view__stat-label">Member Since</span>
        </div>
      </div>

      <div className="profile-view__section">
        <h3 className="profile-view__section-title">About</h3>
        <div className="profile-view__about-grid">
          <div className="profile-view__about-item">
            <PhIcon name="envelope-simple" size={16} />
            <span>{currentUser.email}</span>
          </div>
          {currentUser.email_verified !== undefined && (
            <div className="profile-view__about-item">
              <PhIcon name={currentUser.email_verified ? "check-circle" : "warning-circle"} size={16} />
              <span>{currentUser.email_verified ? "Email verified" : "Email not verified"}</span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-view__section">
        <h3 className="profile-view__section-title">Quick Actions</h3>
        <div className="profile-view__actions">
          <button className="profile-view__action" onClick={onEditSettings}>
            <PhIcon name="gear" size={20} />
            <span>Settings</span>
          </button>
          <button className="profile-view__action" onClick={onOpenNotifications}>
            <PhIcon name="bell" size={20} />
            <span>Notifications</span>
          </button>
          <button className="profile-view__action" onClick={onOpenFavorites}>
            <PhIcon name="star" size={20} />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {servers.length > 0 && (
        <div className="profile-view__section">
          <h3 className="profile-view__section-title">Your Servers</h3>
          <div className="profile-view__server-list">
            {servers.map((server) => (
              <div
                key={server.id}
                className="profile-view__server-item"
                onClick={() => onOpenServer(server.id)}
              >
                {server.icon_url ? (
                  <img src={server.icon_url} alt="" className="profile-view__server-icon" />
                ) : (
                  <div className="profile-view__server-icon profile-view__server-icon--fallback">
                    {server.name[0].toUpperCase()}
                  </div>
                )}
                <span className="profile-view__server-name">{server.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
