import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Input, Toast } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import { EmojiPicker } from "./EmojiPicker";
import { sendMessage, sendTyping } from "../services/socket";
import { uploadFile, createMessage } from "../services/api";
import type { MessagePayload, AttachmentPayload } from "../services/socket";
import { searchEmojis, recordEmojiUsage, resolveShortcode } from "../data/emojiData";
import type { EmojiEntry } from "../data/emojiData";

const MAX_FILE_SIZE_MB = 10;

const TYPING_THROTTLE_MS = 2500;

interface Props {
  channelId: string;
  channelName: string;
  /** Called with the confirmed message after a successful send */
  onMessageSent: (msg: MessagePayload) => void;
  /** When true, API is unreachable — use purely local messages */
  mockMode?: boolean;
  /** When true, Hermes WebSocket is connected for real-time delivery */
  wsConnected?: boolean;
  senderId?: string;
  /** Display name to send with typing events */
  senderName?: string;
  /** Open the Gamelet library modal */
  onOpenGamelets?: () => void;
}

export const MessageInput: React.FC<Props> = ({
  channelId,
  channelName,
  onMessageSent,
  mockMode = false,
  wsConnected = false,
  senderId = "local",
  senderName,
  onOpenGamelets,
}) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const lastTypingSent = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAttachMenu]);

  // ── Emoji shortcode autocomplete ──

  const autocompleteQuery = useMemo(() => {
    // Match `:text` at the end of the input (at least 2 chars after the colon)
    const match = value.match(/:([a-z0-9_]{2,})$/i);
    return match ? match[1] : null;
  }, [value]);

  const autocompleteSuggestions = useMemo(() => {
    if (!autocompleteQuery) return [];
    return searchEmojis(autocompleteQuery, 8);
  }, [autocompleteQuery]);

  // Reset autocomplete index when suggestions change
  useEffect(() => {
    setAutocompleteIndex(0);
  }, [autocompleteSuggestions]);

  const applyAutocomplete = useCallback(
    (entry: EmojiEntry) => {
      // Replace the `:query` at end of input with the emoji character
      const colonPos = value.lastIndexOf(":");
      if (colonPos >= 0) {
        setValue(value.slice(0, colonPos) + entry.emoji);
      }
      recordEmojiUsage(entry.shortcode);
    },
    [value],
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        Toast.warning({ content: `${file.name} is not an image`, duration: 2 });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        Toast.error({ content: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`, duration: 2 });
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (newFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...newFiles]);
      setPendingPreviews((prev) => [...prev, ...newPreviews]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleChange = useCallback(
    (val: string) => {
      setValue(val);

      // Throttle typing events: fire immediately, then suppress for TYPING_THROTTLE_MS
      if (wsConnected && val.length > 0) {
        const now = Date.now();
        if (now - lastTypingSent.current >= TYPING_THROTTLE_MS) {
          lastTypingSent.current = now;
          sendTyping(channelId, senderName);
        }
      }
    },
    [channelId, wsConnected, senderName]
  );

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if ((!content && pendingFiles.length === 0) || sending) return;

    setSending(true);
    try {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let attachments: AttachmentPayload[] | undefined;

      // Upload pending files
      if (pendingFiles.length > 0) {
        if (mockMode) {
          // In mock mode, use local object URLs
          attachments = pendingFiles.map((f, i) => ({
            id: `att-${nonce}-${i}`,
            filename: f.name,
            content_type: f.type,
            url: pendingPreviews[i],
          }));
        } else {
          // Upload to Janus
          const uploaded = await Promise.all(pendingFiles.map((f) => uploadFile(f)));
          attachments = uploaded.map((att) => ({
            id: att.id,
            filename: att.filename,
            content_type: att.content_type,
            url: att.url,
          }));
        }
      }

      if (mockMode) {
        // Fully offline — no API, no WebSocket
        const localMsg: MessagePayload = {
          id: nonce,
          content: content || "",
          sender_id: senderId,
          channel_id: channelId,
          timestamp: new Date().toISOString(),
          nonce,
          attachments,
        };
        onMessageSent(localMsg);
      } else {
        // Persist to Janus DB for history (works even without Hermes)
        const saved = await createMessage(channelId, content || "", nonce, attachments);

        // Build the local message payload from the persisted response
        const localMsg: MessagePayload = {
          id: String(saved.id),
          content: saved.content,
          sender_id: String(saved.sender_id),
          channel_id: String(saved.channel_id),
          timestamp: saved.created_at,
          nonce: saved.nonce || undefined,
          attachments: saved.attachments || undefined,
        };
        onMessageSent(localMsg);

        // Push via WebSocket for real-time delivery to other clients (best-effort)
        if (wsConnected) {
          try {
            sendMessage(channelId, content || "", nonce, attachments);
          } catch {
            // WebSocket delivery failed; message is already persisted
          }
        }
      }

      setValue("");
      // Clean up previews (don't revoke mock URLs as they're used in messages)
      if (!mockMode) {
        pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
      }
      setPendingFiles([]);
      setPendingPreviews([]);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      Toast.error({ content: "Message failed to send", duration: 2 });
    } finally {
      setSending(false);
    }
  }, [value, sending, channelId, onMessageSent, mockMode, wsConnected, senderId, pendingFiles, pendingPreviews]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Autocomplete navigation
      if (autocompleteSuggestions.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setAutocompleteIndex((prev) =>
            prev <= 0 ? autocompleteSuggestions.length - 1 : prev - 1,
          );
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setAutocompleteIndex((prev) =>
            prev >= autocompleteSuggestions.length - 1 ? 0 : prev + 1,
          );
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          applyAutocomplete(autocompleteSuggestions[autocompleteIndex]);
          return;
        }
        if (e.key === "Escape") {
          // Clear autocomplete by erasing the partial shortcode
          e.preventDefault();
          const colonPos = value.lastIndexOf(":");
          if (colonPos >= 0) {
            setValue(value.slice(0, colonPos));
          }
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, autocompleteSuggestions, autocompleteIndex, applyAutocomplete, value]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setValue((prev) => prev + emoji);
      setShowEmojiPicker(false);
    },
    [],
  );

  const canSend = value.trim() || pendingFiles.length > 0;

  return (
    <div
      className="chat-area__input-area"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Image preview strip */}
      {pendingPreviews.length > 0 && (
        <div className="chat-area__input-previews">
          {pendingPreviews.map((url, i) => (
            <div key={i} className="chat-area__input-preview">
              <img src={url} alt={pendingFiles[i]?.name || "preview"} />
              <button
                className="chat-area__input-preview__remove"
                onClick={() => removeFile(i)}
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Emoji shortcode autocomplete dropdown */}
      {autocompleteSuggestions.length > 0 && (
        <div className="emoji-autocomplete">
          {autocompleteSuggestions.map((entry, i) => (
            <div
              key={entry.shortcode}
              className={`emoji-autocomplete__item ${i === autocompleteIndex ? "emoji-autocomplete__item--active" : ""}`}
              onMouseEnter={() => setAutocompleteIndex(i)}
              onClick={() => applyAutocomplete(entry)}
            >
              <span className="emoji-autocomplete__emoji">{entry.emoji}</span>
              <span className="emoji-autocomplete__name">:{entry.shortcode}:</span>
            </div>
          ))}
        </div>
      )}

      <Input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste as any}
        placeholder={`Message #${channelName}`}
        prefix={
          <div className="attach-menu-anchor" ref={attachMenuRef}>
            <div
              className={`attach-menu__trigger ${showAttachMenu ? "attach-menu__trigger--active" : ""}`}
              onClick={() => setShowAttachMenu((prev) => !prev)}
            >
              <PhIcon name="plus-circle" size={22} />
            </div>

            {showAttachMenu && (
              <div className="attach-menu__popover">
                <div
                  className="attach-menu__item"
                  onClick={() => {
                    setShowAttachMenu(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <PhIcon name="file" size={18} />
                  <span>Upload a File</span>
                </div>
                <div
                  className="attach-menu__item"
                  onClick={() => {
                    setShowAttachMenu(false);
                    Toast.info({ content: "Threads coming soon", duration: 1.5 });
                  }}
                >
                  <PhIcon name="chat-text" size={18} />
                  <span>Create Thread</span>
                </div>
                <div
                  className="attach-menu__item"
                  onClick={() => {
                    setShowAttachMenu(false);
                    Toast.info({ content: "Polls coming soon", duration: 1.5 });
                  }}
                >
                  <PhIcon name="chart-bar" size={18} />
                  <span>Create Poll</span>
                </div>
                {onOpenGamelets && (
                  <div
                    className="attach-menu__item"
                    onClick={() => {
                      setShowAttachMenu(false);
                      onOpenGamelets();
                    }}
                  >
                    <PhIcon name="circles-four" size={18} />
                    <span>Use Apps</span>
                  </div>
                )}
              </div>
            )}
          </div>
        }
        suffix={
          <div className="message-input__suffix">
            <div className="emoji-picker-anchor" ref={emojiAnchorRef}>
              <div
                className={`message-input__emoji-btn ${showEmojiPicker ? "message-input__emoji-btn--active" : ""}`}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
              >
                <PhIcon name="smiley" size={22} />
              </div>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            <PhIcon
              name="paper-plane-right"
              weight="fill"
              className={canSend ? "message-input__send--active" : "message-input__send--muted"}
              style={{ cursor: canSend ? "pointer" : "default" }}
              onClick={handleSend}
            />
          </div>
        }
        size="large"
        className="message-input__field"
      />
    </div>
  );
};
