import React, { useEffect, useRef, useState, useCallback } from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { MessagePayload, AttachmentPayload } from "../services/socket";

/** Map of sender_id → display name for resolving usernames. */
export type UserMap = Record<string, string>;

interface Props {
  channelName: string;
  channelTopic?: string | null;
  messages: MessagePayload[];
  /** Optional lookup for resolving sender IDs to display names */
  userMap?: UserMap;
  /** Current user ID — used to show "Delete" only on own messages */
  currentUserId?: string;
  /** Called when the user deletes a message */
  onDeleteMessage?: (messageId: string) => void;
  /** When true, user can delete any message (MANAGE_MESSAGES permission) */
  canManageMessages?: boolean;
  /** Whether this is a DM view (shows call buttons) */
  isDm?: boolean;
  /** Called when user clicks voice call */
  onVoiceCall?: () => void;
  /** Called when user clicks video call */
  onVideoCall?: () => void;
  /** Responsive shell toggle for navigation drawer */
  showNavigationToggle?: boolean;
  onToggleNavigation?: () => void;
  /** Responsive shell toggle for detail drawer */
  showDetailsToggle?: boolean;
  onToggleDetails?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function resolveName(senderId: string, userMap?: UserMap): string {
  if (userMap && userMap[senderId]) return userMap[senderId];
  if (senderId.startsWith("u-")) {
    const cleaned = senderId.slice(2);
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (senderId.length > 16 && senderId.includes("-")) {
    return senderId.slice(0, 8);
  }
  return senderId.charAt(0).toUpperCase() + senderId.slice(1);
}

// ── Context Menu ──

interface ContextMenuState {
  x: number;
  y: number;
  messageId: string;
  senderId: string;
  content: string;
  attachment?: AttachmentPayload;
}

// ── Image Lightbox ──

interface LightboxState {
  url: string;
  filename: string;
}

/** Renders an attachment image with a React-managed error state (no DOM mutation). */
const AttachmentImage: React.FC<{
  att: AttachmentPayload;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ att, onOpen, onContextMenu }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="message__attachment-broken"
        onContextMenu={onContextMenu}
      >
        [Image: {att.filename}]
      </div>
    );
  }

  return (
    <img
      src={att.url}
      alt={att.filename}
      className="message__attachment-img"
      loading="lazy"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onError={() => setFailed(true)}
    />
  );
};

export const ChatView: React.FC<Props> = ({
  channelName,
  channelTopic,
  messages,
  userMap,
  currentUserId,
  onDeleteMessage,
  canManageMessages = false,
  isDm = false,
  onVoiceCall,
  onVideoCall,
  showNavigationToggle = false,
  onToggleNavigation,
  showDetailsToggle = false,
  onToggleDetails,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Close context menu on click anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Close lightbox on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    if (lightbox) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [lightbox]);

  const handleMessageContextMenu = useCallback(
    (e: React.MouseEvent, msg: MessagePayload) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        messageId: msg.id,
        senderId: msg.sender_id,
        content: msg.content,
      });
    },
    []
  );

  const handleImageContextMenu = useCallback(
    (e: React.MouseEvent, msg: MessagePayload, att: AttachmentPayload) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        messageId: msg.id,
        senderId: msg.sender_id,
        content: msg.content,
        attachment: att,
      });
    },
    []
  );

  const handleCopyText = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.content).catch(() => {});
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleCopyImageUrl = useCallback(() => {
    if (contextMenu?.attachment) {
      navigator.clipboard.writeText(contextMenu.attachment.url).catch(() => {});
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleOpenImage = useCallback(() => {
    if (contextMenu?.attachment) {
      setLightbox({
        url: contextMenu.attachment.url,
        filename: contextMenu.attachment.filename,
      });
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleSaveImage = useCallback(() => {
    if (contextMenu?.attachment) {
      const a = document.createElement("a");
      a.href = contextMenu.attachment.url;
      a.download = contextMenu.attachment.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu && onDeleteMessage) {
      onDeleteMessage(contextMenu.messageId);
    }
    setContextMenu(null);
  }, [contextMenu, onDeleteMessage]);

  const canDelete = contextMenu
    ? contextMenu.senderId === currentUserId || canManageMessages
    : false;

  return (
    <div className="chat-area">
      <div className="chat-area__header">
        {showNavigationToggle && (
          <Tooltip content="Toggle Navigation" position="bottom">
            <div className="chat-area__header__action-btn chat-area__header__action-btn--shell" onClick={onToggleNavigation}>
              <PhIcon name="sidebar" size={20} />
            </div>
          </Tooltip>
        )}
        <span className="chat-area__header__name">
          {isDm ? (
            <><PhIcon name="at" size={18} style={{ opacity: 0.6, marginRight: 4 }} />{channelName}</>
          ) : (
            <>{'# '}{channelName}</>
          )}
        </span>
        {channelTopic && (
          <span className="chat-area__header__topic">{channelTopic}</span>
        )}
        <div className="chat-area__header__actions">
          {isDm && (
            <>
              <Tooltip content="Start Voice Call" position="bottom">
                <div className="chat-area__header__action-btn" onClick={onVoiceCall}>
                  <PhIcon name="phone" size={20} />
                </div>
              </Tooltip>
              <Tooltip content="Start Video Call" position="bottom">
                <div className="chat-area__header__action-btn" onClick={onVideoCall}>
                  <PhIcon name="video-camera" size={20} />
                </div>
              </Tooltip>
              <div className="chat-area__header__divider" />
            </>
          )}
          <Tooltip content={isDm ? "Pinned Messages" : "Pinned Messages  (Ctrl+P)"} position="bottom">
            <div className="chat-area__header__action-btn">
              <PhIcon name="push-pin" size={20} />
            </div>
          </Tooltip>
          {isDm ? (
            <Tooltip content={showDetailsToggle ? "Toggle Profile" : "User Profile"} position="bottom">
              <div className="chat-area__header__action-btn" onClick={showDetailsToggle ? onToggleDetails : undefined}>
                <PhIcon name="user" size={20} />
              </div>
            </Tooltip>
          ) : (
            <Tooltip content={showDetailsToggle ? "Toggle Member List" : "Member List  (Ctrl+M)"} position="bottom">
              <div className="chat-area__header__action-btn" onClick={showDetailsToggle ? onToggleDetails : undefined}>
                <PhIcon name="users" size={20} />
              </div>
            </Tooltip>
          )}
          <Tooltip content="Search  (Ctrl+F)" position="bottom">
            <div className="chat-area__header__action-btn">
              <PhIcon name="magnifying-glass" size={20} />
            </div>
          </Tooltip>
        </div>
      </div>

      <div className="chat-area__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-area__empty-state">
            <span className="chat-area__empty-title">Nothing here yet</span>
            <span className="chat-area__empty-copy">Start the conversation and Proteus will keep the thread warm.</span>
          </div>
        )}

        {messages.map((msg) => {
          const name = resolveName(msg.sender_id, userMap);
          return (
            <div
              className="message"
              key={msg.id}
              onContextMenu={(e) => handleMessageContextMenu(e, msg)}
            >
              <div className="message__avatar">
                {name[0]?.toUpperCase() || "?"}
              </div>
              <div className="message__body">
                <div className="message__header">
                  <span className="message__author">{name}</span>
                  <span className="message__timestamp">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                {msg.content && (
                  <div className="message__content">{msg.content}</div>
                )}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="message__attachments">
                    {msg.attachments.map((att) => (
                      <div key={att.id} className="message__attachment">
                        <AttachmentImage
                          att={att}
                          onOpen={() =>
                            setLightbox({ url: att.url, filename: att.filename })
                          }
                          onContextMenu={(e) =>
                            handleImageContextMenu(e, msg, att)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.attachment && (
            <>
              <div className="context-menu__item" onClick={handleOpenImage}>
                Open Image
              </div>
              <div className="context-menu__item" onClick={handleSaveImage}>
                Save Image
              </div>
              <div className="context-menu__item" onClick={handleCopyImageUrl}>
                Copy Image URL
              </div>
              <div className="context-menu__divider" />
            </>
          )}
          {contextMenu.content && (
            <div className="context-menu__item" onClick={handleCopyText}>
              Copy Text
            </div>
          )}
          {canDelete && (
            <>
              <div className="context-menu__divider" />
              <div
                className="context-menu__item context-menu__item--danger"
                onClick={handleDelete}
              >
                Delete Message
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {lightbox && (
        <div
          className="lightbox"
          onClick={() => setLightbox(null)}
        >
          <div
            className="lightbox__content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.filename}
              className="lightbox__img"
            />
            <div className="lightbox__toolbar">
              <span className="lightbox__filename">{lightbox.filename}</span>
              <div className="lightbox__actions">
                <a
                  href={lightbox.url}
                  download={lightbox.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="lightbox__btn"
                >
                  Save
                </a>
                <button
                  className="lightbox__btn"
                  onClick={() => {
                    navigator.clipboard.writeText(lightbox.url).catch(() => {});
                  }}
                >
                  Copy URL
                </button>
                <button
                  className="lightbox__btn"
                  onClick={() => setLightbox(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
