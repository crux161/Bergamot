export type BergamotStreamKind = "channel" | "dm";
export type BergamotNotificationType = "mention" | "reply" | "dm_unread_summary";
export type BergamotSavedItemKind = "channel" | "dm";
export type BergamotSearchScope = "channel" | "server" | "dm" | "global";

export interface BergamotActor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface BergamotStreamContext {
  streamKind: BergamotStreamKind;
  streamId: string;
  serverId: string | null;
  serverName: string | null;
  channelName: string | null;
  peerDisplayName: string | null;
}

export interface BergamotNotification<MessageShape = unknown> {
  id: string;
  notificationType: BergamotNotificationType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  actor: BergamotActor | null;
  messageId: string | null;
  message: MessageShape | null;
  stream: BergamotStreamContext;
  unreadCount: number | null;
}

export interface BergamotMention<MessageShape = unknown> {
  id: string;
  createdAt: string;
  readAt: string | null;
  actor: BergamotActor | null;
  messageId: string;
  message: MessageShape;
  stream: BergamotStreamContext;
}

export interface BergamotSavedItem {
  id: string;
  kind: BergamotSavedItemKind;
  targetId: string;
  label: string;
  subtitle: string;
  routeHash: string;
  icon: string;
  createdAt: string;
}

export interface BergamotUnreadSummary {
  totalUnread: number;
  unreadNotifications: number;
  unreadMentions: number;
  unreadReplies: number;
  unreadDmConversations: number;
  unreadDmMessages: number;
}

export interface BergamotMessageSearchResult<MessageShape = unknown> {
  id: string;
  cursor: string;
  snippet: string;
  message: MessageShape;
  stream: BergamotStreamContext;
}

export interface BergamotSearchResultsPage<MessageShape = unknown> {
  items: Array<BergamotMessageSearchResult<MessageShape>>;
  nextCursor: string | null;
}
