import React, { useState, useCallback, useRef } from "react";
import { Input } from "@douyinfe/semi-ui";
import { IconSend } from "@douyinfe/semi-icons";
import { sendMessage, sendTyping } from "../services/socket";

interface Props {
  channelId: string;
  channelName: string;
  onMessageSent: () => void;
}

export const MessageInput: React.FC<Props> = ({
  channelId,
  channelName,
  onMessageSent,
}) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback(
    (val: string) => {
      setValue(val);

      // Debounced typing indicator
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        sendTyping(channelId);
      }, 300);
    },
    [channelId]
  );

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await sendMessage(channelId, content, nonce);
      setValue("");
      onMessageSent();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }, [value, sending, channelId, onMessageSent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="chat-area__input-area">
      <Input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`Message #${channelName}`}
        suffix={
          <IconSend
            style={{
              cursor: value.trim() ? "pointer" : "default",
              color: value.trim() ? "#6b9362" : "#656255",
            }}
            onClick={handleSend}
          />
        }
        size="large"
        style={{
          backgroundColor: "#3a403b",
          borderColor: "#374231",
          color: "#a5ba93",
          borderRadius: 8,
        }}
      />
    </div>
  );
};
