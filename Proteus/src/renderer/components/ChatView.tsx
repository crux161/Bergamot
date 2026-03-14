import React, { useEffect, useRef } from "react";
import type { MessagePayload } from "../services/socket";

interface Props {
  channelName: string;
  channelTopic?: string | null;
  messages: MessagePayload[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function senderInitial(senderId: string): string {
  return senderId.slice(0, 2).toUpperCase();
}

export const ChatView: React.FC<Props> = ({
  channelName,
  channelTopic,
  messages,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="chat-area">
      <div className="chat-area__header">
        <span className="chat-area__header__name"># {channelName}</span>
        {channelTopic && (
          <span className="chat-area__header__topic">{channelTopic}</span>
        )}
      </div>

      <div className="chat-area__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#656255",
              fontSize: 14,
            }}
          >
            No messages yet. Say something!
          </div>
        )}

        {messages.map((msg) => (
          <div className="message" key={msg.id}>
            <div className="message__avatar">
              {senderInitial(msg.sender_id)}
            </div>
            <div className="message__body">
              <div className="message__header">
                <span className="message__author">
                  {msg.sender_id.slice(0, 8)}
                </span>
                <span className="message__timestamp">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div className="message__content">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
