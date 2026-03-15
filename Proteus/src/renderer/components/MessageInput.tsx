import React, { useState, useCallback, useRef } from "react";
import { Input, Toast } from "@douyinfe/semi-ui";
import { IconSend, IconImage } from "@douyinfe/semi-icons";
import { sendMessage, sendTyping } from "../services/socket";
import { uploadFile, createMessage } from "../services/api";
import type { MessagePayload, AttachmentPayload } from "../services/socket";

const MAX_FILE_SIZE_MB = 10;

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
}

export const MessageInput: React.FC<Props> = ({
  channelId,
  channelName,
  onMessageSent,
  mockMode = false,
  wsConnected = false,
  senderId = "local",
}) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (wsConnected) {
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
          sendTyping(channelId);
        }, 300);
      }
    },
    [channelId, mockMode]
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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
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

      <Input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste as any}
        placeholder={`Message #${channelName}`}
        prefix={
          <IconImage
            style={{ cursor: "pointer", color: "#b5bac1" }}
            onClick={() => fileInputRef.current?.click()}
          />
        }
        suffix={
          <IconSend
            style={{
              cursor: canSend ? "pointer" : "default",
              color: canSend ? "#6b9362" : "#5c5e66",
            }}
            onClick={handleSend}
          />
        }
        size="large"
        style={{
          backgroundColor: "#383a40",
          borderColor: "#3f4147",
          color: "#e0e1e5",
          borderRadius: 8,
        }}
      />
    </div>
  );
};
