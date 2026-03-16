import React from "react";

export interface TypingUser {
  user_id: string;
  username: string;
}

interface Props {
  typingUsers: TypingUser[];
}

/**
 * Discord-style typing indicator shown above/below the message input.
 *
 * Display rules:
 *   1 user  → "Alice is typing..."
 *   2 users → "Alice and Bob are typing..."
 *   3 users → "Alice, Bob, and Carol are typing..."
 *   4+      → "Alice, Bob, and 2 others are typing..."
 */
export const TypingIndicator: React.FC<Props> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.username);
  let text: string;

  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else if (names.length === 3) {
    text = `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  } else {
    text = `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing`;
  }

  return (
    <div className="typing-indicator">
      <span className="typing-indicator__dots">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </span>
      <span className="typing-indicator__text">
        <strong>{text}</strong>...
      </span>
    </div>
  );
};
