import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { MessagePayload, AttachmentPayload } from "../services/socket";
import { useStoreSnapshot } from "../stores/createStore";
import { messageReplyStore } from "../stores/messageReplyStore";
import { messageReactionsStore } from "../stores/messageReactionsStore";
import { channelPinsStore } from "../stores/channelPinsStore";
import type { ReactionCount, MessageRead } from "../services/api";

/** Map of sender_id → display name for resolving usernames. */
export type UserMap = Record<string, string>;

interface Props {
  channelId: string;
  channelName: string;
  channelTopic?: string | null;
  messages: MessagePayload[];
  /** Optional lookup for resolving sender IDs to display names */
  userMap?: UserMap;
  /** Current user ID — used to show "Delete" only on own messages */
  currentUserId?: string;
  /** Called when the user deletes a message */
  onDeleteMessage?: (messageId: string) => void;
  /** Called when the user reports a message */
  onReportMessage?: (messageId: string) => void;
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
  /** Indicates whether the current route is saved to local favorites */
  isFavorite?: boolean;
  /** Toggle local favorites/bookmarks entry */
  onToggleFavorite?: () => void;
  /** Open the global command palette */
  onOpenCommandPalette?: () => void;
  /** Open message search for the current context */
  onOpenMessageSearch?: () => void;
  /** Called when user wants to add/toggle a reaction */
  onReactionAdd?: (messageId: string, emoji: string) => void;
  /** Called when user removes their reaction */
  onReactionRemove?: (messageId: string, emoji: string) => void;
  /** Called when user wants to pin/unpin a message */
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  /** Called when user wants to edit a message */
  onEditMessage?: (messageId: string, content: string) => void;
  /** Pinned messages for the pins panel */
  pinnedMessages?: MessageRead[];
  /** Whether pins panel is loading */
  pinsLoading?: boolean;
  /** Toggle the pins panel */
  onTogglePinsPanel?: () => void;
  /** Whether pins panel is open */
  pinsPanelOpen?: boolean;
  /** Called when user wants to bookmark/unbookmark a message */
  onBookmarkMessage?: (messageId: string) => void;
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

// ── Quick Reaction Picker (inline) ──

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😢", "🔥"];

const QuickReactionPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  return (
    <div className="quick-reaction-picker" onClick={(e) => e.stopPropagation()}>
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className="quick-reaction-picker__emoji"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

// ── Reaction Bar ──

const ReactionBar: React.FC<{
  reactions: ReactionCount[];
  onToggle: (emoji: string, currentlyReacted: boolean) => void;
}> = ({ reactions, onToggle }) => {
  if (reactions.length === 0) return null;
  return (
    <div className="message__reactions">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          className={`message__reaction ${r.me ? "message__reaction--active" : ""}`}
          onClick={() => onToggle(r.emoji, r.me)}
          title={`${r.count} reaction${r.count !== 1 ? "s" : ""}`}
        >
          <span className="message__reaction-emoji">{r.emoji}</span>
          <span className="message__reaction-count">{r.count}</span>
        </button>
      ))}
    </div>
  );
};

// ── Context Menu ──

interface ContextMenuState {
  x: number;
  y: number;
  messageId: string;
  senderId: string;
  content: string;
  attachment?: AttachmentPayload;
  pinned?: boolean;
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

// ── Reply Preview (inline above a message) ──

const ReplyPreview: React.FC<{
  replyTo: { sender_id: string; content: string; id: string };
  userMap?: UserMap;
  onClickReply?: () => void;
}> = ({ replyTo, userMap, onClickReply }) => {
  const name = resolveName(replyTo.sender_id, userMap);
  return (
    <div className="message__reply-preview" onClick={onClickReply}>
      <PhIcon name="arrow-bend-up-left" size={14} />
      <span className="message__reply-author">{name}</span>
      <span className="message__reply-content">
        {replyTo.content.length > 100 ? replyTo.content.slice(0, 100) + "…" : replyTo.content}
      </span>
    </div>
  );
};

// ── Message Action Toolbar (hover bar) ──

const MessageActionBar: React.FC<{
  msg: MessagePayload;
  isOwn: boolean;
  canManage: boolean;
  onReply: () => void;
  onReact: () => void;
  onPin: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ msg, isOwn, canManage, onReply, onReact, onPin, onEdit, onDelete }) => {
  return (
    <div className="message__action-bar">
      <Tooltip content="React" position="top">
        <button className="message__action-btn" onClick={onReact}>
          <PhIcon name="smiley" size={16} />
        </button>
      </Tooltip>
      <Tooltip content="Reply" position="top">
        <button className="message__action-btn" onClick={onReply}>
          <PhIcon name="arrow-bend-up-left" size={16} />
        </button>
      </Tooltip>
      <Tooltip content={msg.pinned ? "Unpin" : "Pin"} position="top">
        <button className="message__action-btn" onClick={onPin}>
          <PhIcon name="push-pin" size={16} weight={msg.pinned ? "fill" : "regular"} />
        </button>
      </Tooltip>
      {isOwn && onEdit && (
        <Tooltip content="Edit" position="top">
          <button className="message__action-btn" onClick={onEdit}>
            <PhIcon name="pencil-simple" size={16} />
          </button>
        </Tooltip>
      )}
      {(isOwn || canManage) && onDelete && (
        <Tooltip content="Delete" position="top">
          <button className="message__action-btn message__action-btn--danger" onClick={onDelete}>
            <PhIcon name="trash" size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

// ── Pins Panel ──

const PinsPanel: React.FC<{
  messages: MessageRead[];
  loading: boolean;
  userMap?: UserMap;
  onUnpin?: (messageId: string) => void;
  onClose: () => void;
}> = ({ messages, loading, userMap, onUnpin, onClose }) => {
  return (
    <div className="pins-panel">
      <div className="pins-panel__header">
        <span className="pins-panel__title">Pinned Messages</span>
        <button className="pins-panel__close" onClick={onClose}>
          <PhIcon name="x" size={18} />
        </button>
      </div>
      <div className="pins-panel__body">
        {loading && <div className="pins-panel__loading">Loading pins…</div>}
        {!loading && messages.length === 0 && (
          <div className="pins-panel__empty">No pinned messages yet.</div>
        )}
        {messages.map((msg) => {
          const name = resolveName(msg.sender_id, userMap);
          return (
            <div key={msg.id} className="pins-panel__message">
              <div className="pins-panel__message-header">
                <span className="pins-panel__message-author">{name}</span>
                <span className="pins-panel__message-time">{formatTime(msg.created_at)}</span>
              </div>
              <div className="pins-panel__message-content">{msg.content}</div>
              {onUnpin && (
                <button className="pins-panel__unpin" onClick={() => onUnpin(msg.id)}>
                  <PhIcon name="push-pin" size={14} /> Unpin
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Inline Edit Mode ──

const MessageEditInput: React.FC<{
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}> = ({ initialContent, onSave, onCancel }) => {
  const [value, setValue] = useState(initialContent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && value.trim() !== initialContent) {
        onSave(value.trim());
      } else {
        onCancel();
      }
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="message__edit-input">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="message__edit-field"
      />
      <div className="message__edit-hint">
        escape to <button onClick={onCancel}>cancel</button> · enter to <button onClick={() => onSave(value.trim())}>save</button>
      </div>
    </div>
  );
};

export const ChatView: React.FC<Props> = ({
  channelId,
  channelName,
  channelTopic,
  messages,
  userMap,
  currentUserId,
  onDeleteMessage,
  onReportMessage,
  canManageMessages = false,
  isDm = false,
  onVoiceCall,
  onVideoCall,
  showNavigationToggle = false,
  onToggleNavigation,
  showDetailsToggle = false,
  onToggleDetails,
  isFavorite = false,
  onToggleFavorite,
  onOpenCommandPalette,
  onOpenMessageSearch,
  onReactionAdd,
  onReactionRemove,
  onPinMessage,
  onUnpinMessage,
  onEditMessage,
  pinnedMessages = [],
  pinsLoading = false,
  onTogglePinsPanel,
  pinsPanelOpen = false,
  onBookmarkMessage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Store subscriptions
  const replyState = useStoreSnapshot(messageReplyStore);
  const reactionsState = useStoreSnapshot(messageReactionsStore);

  const highlightedId = replyState.highlightedMessageId;

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
        pinned: msg.pinned,
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
        pinned: msg.pinned,
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

  const handleReport = useCallback(() => {
    if (contextMenu && onReportMessage) {
      onReportMessage(contextMenu.messageId);
    }
    setContextMenu(null);
  }, [contextMenu, onReportMessage]);

  const handleReplyFromContext = useCallback(() => {
    if (contextMenu) {
      const msg = messages.find((m) => m.id === contextMenu.messageId);
      if (msg) {
        messageReplyStore.startReply(channelId, msg);
      }
    }
    setContextMenu(null);
  }, [contextMenu, messages, channelId]);

  const handleBookmarkFromContext = useCallback(() => {
    if (contextMenu) {
      onBookmarkMessage?.(contextMenu.messageId);
    }
    setContextMenu(null);
  }, [contextMenu, onBookmarkMessage]);

  const handlePinFromContext = useCallback(() => {
    if (contextMenu) {
      if (contextMenu.pinned) {
        onUnpinMessage?.(contextMenu.messageId);
      } else {
        onPinMessage?.(contextMenu.messageId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, onPinMessage, onUnpinMessage]);

  const handleReactionToggle = useCallback(
    (messageId: string, emoji: string, currentlyReacted: boolean) => {
      if (currentlyReacted) {
        onReactionRemove?.(messageId, emoji);
      } else {
        onReactionAdd?.(messageId, emoji);
      }
    },
    [onReactionAdd, onReactionRemove]
  );

  const handleClickReplyPreview = useCallback((replyToId: string) => {
    messageReplyStore.highlightMessage(replyToId);
    // Scroll to the message
    const el = document.getElementById(`msg-${replyToId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Build a lookup of message-id → message for quick reply_to resolution
  const messageById = useMemo(() => {
    const map: Record<string, MessagePayload> = {};
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

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
          <Tooltip content="Pinned Messages" position="bottom">
            <div
              className={`chat-area__header__action-btn ${pinsPanelOpen ? "chat-area__header__action-btn--active" : ""}`}
              onClick={onTogglePinsPanel}
            >
              <PhIcon name="push-pin" size={20} />
              {pinnedMessages.length > 0 && (
                <span className="chat-area__header__badge">{pinnedMessages.length}</span>
              )}
            </div>
          </Tooltip>
          {onToggleFavorite && (
            <Tooltip content={isFavorite ? "Remove from Favorites" : "Add to Favorites"} position="bottom">
              <div
                className={`chat-area__header__action-btn ${isFavorite ? "chat-area__header__action-btn--active" : ""}`}
                onClick={onToggleFavorite}
              >
                <PhIcon name="star" size={20} weight={isFavorite ? "fill" : "regular"} />
              </div>
            </Tooltip>
          )}
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
            <div className="chat-area__header__action-btn" onClick={onOpenMessageSearch || onOpenCommandPalette}>
              <PhIcon name="magnifying-glass" size={20} />
            </div>
          </Tooltip>
        </div>
      </div>

      <div className="chat-area__body">
        {/* Pins Panel (slide-over) */}
        {pinsPanelOpen && (
          <PinsPanel
            messages={pinnedMessages}
            loading={pinsLoading}
            userMap={userMap}
            onUnpin={onUnpinMessage}
            onClose={() => onTogglePinsPanel?.()}
          />
        )}

        <div className="chat-area__messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-area__empty-state">
              <span className="chat-area__empty-title">Nothing here yet</span>
              <span className="chat-area__empty-copy">Start the conversation and Proteus will keep the thread warm.</span>
            </div>
          )}

          {messages.map((msg) => {
            const name = resolveName(msg.sender_id, userMap);
            const reactions = reactionsState.reactions[msg.id] ?? (msg.reaction_counts || []);
            const isOwn = msg.sender_id === currentUserId;
            const isHighlighted = highlightedId === msg.id;
            const isEditing = editingMessageId === msg.id;

            // Resolve reply reference — from the message payload or from loaded messages
            const replyRef = msg.reply_to_id
              ? (msg as any).reply_to ?? messageById[msg.reply_to_id] ?? null
              : null;

            return (
              <div
                id={`msg-${msg.id}`}
                className={`message ${isHighlighted ? "message--highlighted" : ""} ${msg.pinned ? "message--pinned" : ""}`}
                key={msg.id}
                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => {
                  setHoveredMessageId(null);
                  if (reactionPickerMessageId === msg.id) {
                    setReactionPickerMessageId(null);
                  }
                }}
              >
                {/* Reply preview above the message */}
                {replyRef && (
                  <ReplyPreview
                    replyTo={replyRef}
                    userMap={userMap}
                    onClickReply={() => handleClickReplyPreview(replyRef.id)}
                  />
                )}

                <div className="message__row">
                  <div className="message__avatar">
                    {name[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="message__body">
                    <div className="message__header">
                      <span className="message__author">{name}</span>
                      <span className="message__timestamp">
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.edited_at && (
                        <Tooltip content={`Edited ${formatTime(msg.edited_at)}`} position="top">
                          <span className="message__edited">(edited)</span>
                        </Tooltip>
                      )}
                      {msg.pinned && (
                        <span className="message__pin-badge">
                          <PhIcon name="push-pin" size={12} weight="fill" /> pinned
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <MessageEditInput
                        initialContent={msg.content}
                        onSave={(content) => {
                          onEditMessage?.(msg.id, content);
                          setEditingMessageId(null);
                        }}
                        onCancel={() => setEditingMessageId(null)}
                      />
                    ) : (
                      <>
                        {msg.content && (
                          <div className="message__content">{msg.content}</div>
                        )}
                      </>
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
                    {/* Reaction bar */}
                    <ReactionBar
                      reactions={reactions}
                      onToggle={(emoji, reacted) => handleReactionToggle(msg.id, emoji, reacted)}
                    />
                  </div>

                  {/* Hover action bar */}
                  {hoveredMessageId === msg.id && !isEditing && (
                    <MessageActionBar
                      msg={msg}
                      isOwn={isOwn}
                      canManage={canManageMessages}
                      onReply={() => messageReplyStore.startReply(channelId, msg)}
                      onReact={() => setReactionPickerMessageId(msg.id)}
                      onPin={() => {
                        if (msg.pinned) {
                          onUnpinMessage?.(msg.id);
                        } else {
                          onPinMessage?.(msg.id);
                        }
                      }}
                      onEdit={isOwn ? () => setEditingMessageId(msg.id) : undefined}
                      onDelete={(isOwn || canManageMessages) && onDeleteMessage
                        ? () => onDeleteMessage(msg.id)
                        : undefined
                      }
                    />
                  )}

                  {/* Quick reaction picker */}
                  {reactionPickerMessageId === msg.id && (
                    <QuickReactionPicker
                      onSelect={(emoji) => onReactionAdd?.(msg.id, emoji)}
                      onClose={() => setReactionPickerMessageId(null)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
          <div className="context-menu__item" onClick={handleReplyFromContext}>
            <PhIcon name="arrow-bend-up-left" size={14} /> Reply
          </div>
          <div className="context-menu__item" onClick={handlePinFromContext}>
            <PhIcon name="push-pin" size={14} /> {contextMenu.pinned ? "Unpin" : "Pin"}
          </div>
          {onBookmarkMessage && (
            <div className="context-menu__item" onClick={handleBookmarkFromContext}>
              <PhIcon name="bookmark-simple" size={14} /> Bookmark
            </div>
          )}
          {onReportMessage && (
            <div className="context-menu__item" onClick={handleReport}>
              <PhIcon name="warning-circle" size={14} /> Report Message
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
