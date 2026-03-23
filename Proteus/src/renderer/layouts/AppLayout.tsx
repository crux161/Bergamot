import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Modal, Input, Toast, Select, Tooltip } from "@douyinfe/semi-ui";
import { ServerList } from "../components/ServerList";
import { ChannelList, DmConversation } from "../components/ChannelList";
import { ChatView } from "../components/ChatView";
import { MessageInput } from "../components/MessageInput";
import { MemberList } from "../components/MemberList";
import { SettingsPanel } from "../components/SettingsPanel";
import { ServerSettingsPanel } from "../components/ServerSettingsPanel";
import { TypingIndicator, TypingUser } from "../components/TypingIndicator";
import { GameletLibraryModal, GameletEntry } from "../components/GameletLibraryModal";
import { GameletPlayer } from "../components/GameletPlayer";
import { CallOverlay, CallState } from "../components/CallOverlay";
import { CommandPalette, CommandPaletteItem } from "../components/CommandPalette";
import { ActiveNowSidebar, ActiveFriend } from "../components/ActiveNowSidebar";
import { WorkspacePage, WorkspaceCardItem, WorkspaceListItem } from "../components/WorkspacePage";
import { NotificationInbox } from "../components/NotificationInbox";
import { MessageSearchModal, type MessageSearchScopeOption } from "../components/MessageSearchModal";
import { FriendsView } from "../components/FriendsView";
import { MentionsView } from "../components/MentionsView";
import { ProfileView } from "../components/ProfileView";
import { BookmarksView } from "../components/BookmarksView";
import { PhIcon } from "../components/PhIcon";
import * as api from "../services/api";
import { Permissions, hasPermission } from "../services/api";
import type { MessageRead } from "../services/api";
import * as socket from "../services/socket";
import type { MessagePayload } from "../services/socket";
import { capabilityStore } from "../stores/capabilityStore";
import { useStoreSnapshot } from "../stores/createStore";
import { favoritesStore } from "../stores/favoritesStore";
import { messageReactionsStore } from "../stores/messageReactionsStore";
import { channelPinsStore } from "../stores/channelPinsStore";
import { parseRoute, routerStore } from "../stores/routerStore";
import { messageReplyStore } from "../stores/messageReplyStore";

import { MOCK_SERVERS, MOCK_CHANNELS, MOCK_MESSAGES, MOCK_MEMBERS } from "./mockData";
import { toDmConversation, toMessagePayload, sortMessagesChronologically } from "./messageHelpers";
import { useMessageSearch } from "./useMessageSearch";
import { useNotifications } from "./useNotifications";
import { useSavedItems } from "./useSavedItems";

const ALL_PERMS = 0xFF;

type LayoutMode = "desktop" | "wide-tablet" | "tablet" | "compact";

function resolveLayoutMode(width: number): LayoutMode {
  if (width >= 1440) return "desktop";
  if (width >= 1100) return "wide-tablet";
  if (width >= 820) return "tablet";
  return "compact";
}

interface Props {
  currentUser: api.UserRead;
  onLogout?: () => void;
  onUserUpdated?: (user: api.UserRead) => void;
}

interface UtilityView {
  title: string;
  topic?: string;
  actionTooltip?: string;
  actionIcon?: string;
  onAction?: () => void;
  page: React.ReactNode;
  sidebar?: React.ReactNode;
}

interface PendingFocusMessage {
  streamKind: "channel" | "dm";
  streamId: string;
  guildId: string | null;
  message: api.MessageRead;
}

export const AppLayout: React.FC<Props> = ({ currentUser, onLogout, onUserUpdated }) => {
  const [servers, setServers] = useState<api.ServerRead[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [channels, setChannels] = useState<api.ChannelRead[]>([]);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [usingMockData, setUsingMockData] = useState(false);
  const [hermesConnected, setHermesConnected] = useState(false);
  const [myPermissions, setMyPermissions] = useState<number>(ALL_PERMS);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastReadMarkerByTarget = useRef<Record<string, string>>({});
  const [showGameletLibrary, setShowGameletLibrary] = useState(false);
  const [activeGamelet, setActiveGamelet] = useState<GameletEntry | null>(null);
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [relationships, setRelationships] = useState<api.FriendshipRead[]>([]);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    typeof window === "undefined" ? "desktop" : resolveLayoutMode(window.innerWidth),
  );
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [newDmSearch, setNewDmSearch] = useState("");
  const [newDmResults, setNewDmResults] = useState<api.UserSearchResult[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingFocusMessage, setPendingFocusMessage] = useState<PendingFocusMessage | null>(null);
  const [historyReadyKey, setHistoryReadyKey] = useState<string | null>(null);

  const { route } = useStoreSnapshot(routerStore);
  const { entries: favoriteEntries } = useStoreSnapshot(favoritesStore);
  const { flags } = useStoreSnapshot(capabilityStore);

  const isServerRoute = route.kind === "guildHome" || route.kind === "channel";
  const isDmConversationRoute = route.kind === "dmConversation";
  const isChannelRoute = route.kind === "channel";
  const dmShellMode =
    route.kind === "dmHome"
    || route.kind === "dmConversation"
    || route.kind === "notifications"
    || route.kind === "favorites"
    || route.kind === "bookmarks"
    || route.kind === "mentions"
    || route.kind === "you";

  const activeServerId = isServerRoute ? route.guildId : null;
  const activeChannelId = isChannelRoute ? route.channelId : null;
  const activeDmId = isDmConversationRoute ? route.conversationId : null;

  const getDefaultSearchScope = useCallback((): "channel" | "server" | "dm" | "global" => {
    if (route.kind === "channel") return "channel";
    if (route.kind === "guildHome") return "server";
    if (route.kind === "dmConversation") return "dm";
    return "global";
  }, [route.kind]);

  const getSearchTargetId = useCallback(
    (scope: "channel" | "server" | "dm" | "global"): string | null => {
      if (scope === "channel") return activeChannelId;
      if (scope === "server") return activeServerId;
      if (scope === "dm") return activeDmId;
      return null;
    },
    [activeChannelId, activeDmId, activeServerId],
  );

  const search = useMessageSearch({
    enabled: flags.messageSearch,
    getDefaultScope: getDefaultSearchScope,
    getTargetId: getSearchTargetId,
  });

  const inbox = useNotifications(flags.inbox);
  const savedItems = useSavedItems(currentUser.id, flags.savedItems);

  const openMessageSearch = search.openSearch;

  useEffect(() => {
    const handleResize = () => {
      setLayoutMode(resolveLayoutMode(window.innerWidth));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (layoutMode === "desktop") {
      setNavDrawerOpen(false);
      setDetailDrawerOpen(false);
    } else if (layoutMode === "wide-tablet") {
      setNavDrawerOpen(false);
    }
  }, [layoutMode]);

  useEffect(() => {
    if (route.kind !== "channel" && route.kind !== "dmConversation") {
      setDetailDrawerOpen(false);
    }
  }, [route.kind]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f" && flags.messageSearch) {
        event.preventDefault();
        openMessageSearch();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [flags.messageSearch, openMessageSearch]);

  useEffect(() => {
    try {
      socket.connect();
      socket.onOpen(() => {
        console.log("[Proteus] Connected to Hermes");
        setHermesConnected(true);
      });
      socket.onError(() => {
        console.warn("[Proteus] Hermes connection error");
        setHermesConnected(false);
      });
      socket.onClose(() => {
        console.log("[Proteus] Hermes disconnected");
        setHermesConnected(false);
      });
    } catch {
      console.warn("[Proteus] Could not connect to Hermes");
      setHermesConnected(false);
    }
    return () => {
      try {
        socket.disconnect();
      } catch {
        // noop
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    api.listServers().then((nextServers: api.ServerRead[]) => {
      if (cancelled) return;
      setServers(nextServers);
    }).catch(() => {
      if (cancelled) return;
      console.warn("[Proteus] API unreachable — loading mock servers");
      setUsingMockData(true);
      setServers(MOCK_SERVERS);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isServerRoute || !activeServerId || servers.length === 0) return;
    if (!servers.some((server) => server.id === activeServerId)) {
      routerStore.openGuild(servers[0].id);
    }
  }, [servers, isServerRoute, activeServerId]);

  const loadDmConversations = useCallback(() => {
    api.listDMConversations()
      .then((conversations) => {
        setDmConversations(conversations.map(toDmConversation));
      })
      .catch((err) => {
        console.warn("[Proteus] Failed to load DM conversations:", err);
      });
  }, []);

  const loadRelationships = useCallback(() => {
    api.listFriends()
      .then((nextRelationships) => {
        setRelationships(nextRelationships);
      })
      .catch((err) => {
        console.warn("[Proteus] Failed to load relationships:", err);
      });
  }, []);

  const refreshInbox = inbox.refresh;

  const refreshSavedItems = savedItems.refresh;
  const savedItemsAvailable = savedItems.available;

  useEffect(() => {
    loadDmConversations();
  }, [loadDmConversations]);

  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  useEffect(() => {
    refreshSavedItems(true);
  }, [refreshSavedItems]);

  useEffect(() => {
    if (!hermesConnected) return;

    try {
      socket.joinUserChannel(currentUser.id, {
        onNotificationCreated: () => {
          refreshInbox();
          loadDmConversations();
        },
        onNotificationRead: () => {
          refreshInbox();
          loadDmConversations();
        },
        onUnreadCountUpdated: (event) => {
          if (event.summary) {
            inbox.setSummary(event.summary);
          }
          refreshInbox();
          loadDmConversations();
        },
        onSavedItemUpdated: () => {
          refreshSavedItems(false);
        },
        onRelationshipPresenceUpdated: (event) => {
          setRelationships((prev) =>
            prev.map((relationship) =>
              relationship.peer_id === event.user_id
                ? {
                    ...relationship,
                    peer_status: event.status,
                    peer_display_name: event.display_name ?? relationship.peer_display_name,
                    peer_avatar_url: event.avatar_url ?? relationship.peer_avatar_url,
                  }
                : relationship,
            ),
          );
        },
      });
    } catch (err) {
      console.warn("[Proteus] Failed to join private user channel:", err);
    }

    return () => {
      try {
        socket.leaveUserChannel(currentUser.id);
      } catch {
        // noop
      }
    };
  }, [currentUser.id, hermesConnected, loadDmConversations, refreshInbox, refreshSavedItems]);

  useEffect(() => {
    if (!isServerRoute || !activeServerId) return;

    setChannels([]);
    setMessages([]);

    if (usingMockData) {
      setMyPermissions(ALL_PERMS);
      const mockChannels = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChannels);
      if (route.kind === "channel" && !mockChannels.some((channel) => channel.id === route.channelId)) {
        routerStore.openGuild(activeServerId);
      }
      return;
    }

    let cancelled = false;

    api.getMyPermissions(activeServerId).then((permissions) => {
      if (!cancelled) setMyPermissions(permissions);
    }).catch(() => {
      if (!cancelled) setMyPermissions(ALL_PERMS);
    });

    api.listChannels(activeServerId).then((nextChannels) => {
      if (cancelled) return;
      setChannels(nextChannels);
      if (route.kind === "channel" && !nextChannels.some((channel) => channel.id === route.channelId)) {
        routerStore.openGuild(activeServerId);
      }
    }).catch(() => {
      if (cancelled) return;
      const mockChannels = MOCK_CHANNELS[activeServerId] || [];
      setChannels(mockChannels);
      if (route.kind === "channel" && !mockChannels.some((channel) => channel.id === route.channelId)) {
        routerStore.openGuild(activeServerId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeServerId, isServerRoute, route, usingMockData]);

  useEffect(() => {
    if (!isDmConversationRoute || !activeDmId) return;

    setMessages([]);
    setHistoryReadyKey(null);

    api.listDMMessages(activeDmId)
      .then((history) => {
        const mapped: MessagePayload[] = history.map(toMessagePayload);
        setMessages(mapped);
        messageReactionsStore.setFromMessages(mapped);
        setHistoryReadyKey(`dm:${activeDmId}`);
      })
      .catch((err) => {
        console.warn("[Proteus] Failed to load DM messages:", err);
        setHistoryReadyKey(`dm:${activeDmId}`);
      });

    const handleMessage = (message: MessagePayload) => {
      setMessages((prev) => {
        if (message.nonce && prev.some((existing) => existing.nonce === message.nonce)) return prev;
        return [...prev, message];
      });
      setTypingUsers((prev) => prev.filter((user) => user.user_id !== message.sender_id));
      const existingTimer = typingTimers.current.get(message.sender_id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimers.current.delete(message.sender_id);
      }
    };

    const handleTyping = (payload: { user_id: string; username: string }) => {
      if (payload.user_id === currentUser.id) return;
      setTypingUsers((prev) => {
        const exists = prev.some((user) => user.user_id === payload.user_id);
        if (!exists) return [...prev, { user_id: payload.user_id, username: payload.username }];
        return prev;
      });
      const existingTimer = typingTimers.current.get(payload.user_id);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((user) => user.user_id !== payload.user_id));
        typingTimers.current.delete(payload.user_id);
      }, 3000);
      typingTimers.current.set(payload.user_id, timer);
    };

    try {
      socket.joinDMChannel(activeDmId, handleMessage, handleTyping, {
        onReactionAdd: (event) => {
          messageReactionsStore.handleReactionAdd(event.message_id, event.emoji, event.user_id === currentUser.id);
        },
        onReactionRemove: (event) => {
          messageReactionsStore.handleReactionRemove(event.message_id, event.emoji, event.user_id === currentUser.id);
        },
        onMessageEdited: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, content: event.content, edited_at: event.edited_at } : m
          ));
        },
        onMessageDeleted: (event) => {
          setMessages((prev) => prev.filter((m) => m.id !== event.message_id));
        },
        onMessagePinned: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, pinned: true, pinned_at: event.pinned_at, pinned_by: event.pinned_by } : m
          ));
        },
        onMessageUnpinned: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, pinned: false, pinned_at: undefined, pinned_by: undefined } : m
          ));
        },
      });
    } catch {
      // WebSocket unavailable — history from Janus is still shown
    }

    return () => {
      try {
        socket.leaveDMChannel(activeDmId);
      } catch {
        // noop
      }
      setTypingUsers([]);
      typingTimers.current.forEach((timer) => clearTimeout(timer));
      typingTimers.current.clear();
    };
  }, [activeDmId, currentUser.id, isDmConversationRoute]);

  useEffect(() => {
    if (!isChannelRoute || !activeChannelId) return;

    if (usingMockData) {
      setMessages(MOCK_MESSAGES.filter((message) => message.channel_id === activeChannelId));
      setHistoryReadyKey(`channel:${activeChannelId}`);
      return;
    }

    setMessages([]);
    setHistoryReadyKey(null);

    api.listMessages(activeChannelId).then((history) => {
      const mapped: MessagePayload[] = history.map(toMessagePayload);
      setMessages(mapped);
      messageReactionsStore.setFromMessages(mapped);
      setHistoryReadyKey(`channel:${activeChannelId}`);
    }).catch((err) => {
      console.warn("[Proteus] Failed to load message history:", err);
      setHistoryReadyKey(`channel:${activeChannelId}`);
    });

    const handleMessage = (message: MessagePayload) => {
      setMessages((prev) => {
        if (message.nonce && prev.some((existing) => existing.nonce === message.nonce)) return prev;
        return [...prev, message];
      });
      setTypingUsers((prev) => prev.filter((user) => user.user_id !== message.sender_id));
      const existingTimer = typingTimers.current.get(message.sender_id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimers.current.delete(message.sender_id);
      }
    };

    const handleTyping = (payload: { user_id: string; username: string }) => {
      if (payload.user_id === currentUser.id) return;

      setTypingUsers((prev) => {
        const exists = prev.some((user) => user.user_id === payload.user_id);
        if (!exists) {
          return [...prev, { user_id: payload.user_id, username: payload.username }];
        }
        return prev;
      });

      const existingTimer = typingTimers.current.get(payload.user_id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((user) => user.user_id !== payload.user_id));
        typingTimers.current.delete(payload.user_id);
      }, 3000);
      typingTimers.current.set(payload.user_id, timer);
    };

    try {
      socket.joinChannel(activeChannelId, handleMessage, handleTyping, {
        onReactionAdd: (event) => {
          messageReactionsStore.handleReactionAdd(event.message_id, event.emoji, event.user_id === currentUser.id);
        },
        onReactionRemove: (event) => {
          messageReactionsStore.handleReactionRemove(event.message_id, event.emoji, event.user_id === currentUser.id);
        },
        onMessageEdited: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, content: event.content, edited_at: event.edited_at } : m
          ));
        },
        onMessageDeleted: (event) => {
          setMessages((prev) => prev.filter((m) => m.id !== event.message_id));
        },
        onMessagePinned: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, pinned: true, pinned_at: event.pinned_at, pinned_by: event.pinned_by } : m
          ));
        },
        onMessageUnpinned: (event) => {
          setMessages((prev) => prev.map((m) =>
            m.id === event.message_id ? { ...m, pinned: false, pinned_at: undefined, pinned_by: undefined } : m
          ));
        },
      });
    } catch {
      // WebSocket unavailable — history from Janus is still shown
    }

    return () => {
      try {
        socket.leaveChannel(activeChannelId);
      } catch {
        // noop
      }
      setTypingUsers([]);
      typingTimers.current.forEach((timer) => clearTimeout(timer));
      typingTimers.current.clear();
    };
  }, [activeChannelId, currentUser.id, isChannelRoute, usingMockData]);

  useEffect(() => {
    if (usingMockData || messages.length === 0) return;

    const activeTargetKind = isDmConversationRoute
      ? "dm"
      : isChannelRoute
        ? "channel"
        : null;
    const activeTargetId = isDmConversationRoute
      ? activeDmId
      : isChannelRoute
        ? activeChannelId
        : null;

    if (!activeTargetKind || !activeTargetId) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const markerKey = `${activeTargetKind}:${activeTargetId}`;
    if (lastReadMarkerByTarget.current[markerKey] === lastMessage.id) return;

    lastReadMarkerByTarget.current[markerKey] = lastMessage.id;
    api.markReadState(activeTargetKind, activeTargetId, lastMessage.id)
      .then(() => {
        if (activeTargetKind === "dm") {
          loadDmConversations();
        }
        refreshInbox();
      })
      .catch(() => {
        delete lastReadMarkerByTarget.current[markerKey];
      });
  }, [
    activeChannelId,
    activeDmId,
    isChannelRoute,
    isDmConversationRoute,
    loadDmConversations,
    messages,
    refreshInbox,
    usingMockData,
  ]);

  useEffect(() => {
    if (!isChannelRoute && !isDmConversationRoute) {
      setHistoryReadyKey(null);
    }
  }, [isChannelRoute, isDmConversationRoute]);

  const handleMessageSent = useCallback((message: MessagePayload) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (usingMockData && isChannelRoute) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      return;
    }
    if (!isChannelRoute || !activeChannelId) return;
    try {
      await api.deleteMessage(activeChannelId, messageId);
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to delete message", duration: 2 });
    }
  }, [activeChannelId, isChannelRoute, usingMockData]);

  const handleReportMessage = useCallback(async (messageId: string) => {
    if (usingMockData) {
      Toast.info({ content: "Reporting is only available against the live Bergamot backend.", duration: 2 });
      return;
    }

    const reason = window.prompt("Tell moderators what is wrong with this message.");
    if (reason == null) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      Toast.warning({ content: "Please include a little more detail so moderators can review it.", duration: 2 });
      return;
    }

    try {
      await api.createReport({ message_id: messageId, reason: trimmed });
      Toast.success({ content: "Report submitted", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to submit report", duration: 2 });
    }
  }, [usingMockData]);

  // ── Reaction handlers ──

  const currentChannelId = isDmConversationRoute ? (activeDmId || "") : (activeChannelId || "");

  const handleReactionAdd = useCallback(async (messageId: string, emoji: string) => {
    if (!currentChannelId) return;
    try {
      await api.addReaction(currentChannelId, messageId, emoji);
      messageReactionsStore.handleReactionAdd(messageId, emoji, true);
      socket.pushReactionAdd(currentChannelId, messageId, emoji);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to add reaction", duration: 2 });
    }
  }, [currentChannelId]);

  const handleReactionRemove = useCallback(async (messageId: string, emoji: string) => {
    if (!currentChannelId) return;
    try {
      await api.removeReaction(currentChannelId, messageId, emoji);
      messageReactionsStore.handleReactionRemove(messageId, emoji, true);
      socket.pushReactionRemove(currentChannelId, messageId, emoji);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to remove reaction", duration: 2 });
    }
  }, [currentChannelId]);

  // ── Pin handlers ──

  const [pinnedMessages, setPinnedMessages] = useState<MessageRead[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsPanelOpen, setPinsPanelOpen] = useState(false);

  // Reset pins panel when channel changes
  useEffect(() => {
    setPinsPanelOpen(false);
    setPinnedMessages([]);
  }, [currentChannelId]);

  const loadPins = useCallback(async () => {
    if (!currentChannelId) return;
    setPinsLoading(true);
    try {
      const pins = await api.listPinnedMessages(currentChannelId);
      setPinnedMessages(pins);
      channelPinsStore.setPins(currentChannelId, pins);
    } catch {
      // Ignore — pins are optional
    } finally {
      setPinsLoading(false);
    }
  }, [currentChannelId]);

  const handlePinMessage = useCallback(async (messageId: string) => {
    if (!currentChannelId) return;
    try {
      await api.pinMessage(currentChannelId, messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, pinned: true } : m));
      socket.pushPinMessage(currentChannelId, messageId);
      loadPins();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to pin message", duration: 2 });
    }
  }, [currentChannelId, loadPins]);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    if (!currentChannelId) return;
    try {
      await api.unpinMessage(currentChannelId, messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, pinned: false } : m));
      socket.pushUnpinMessage(currentChannelId, messageId);
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to unpin message", duration: 2 });
    }
  }, [currentChannelId]);

  const handleTogglePinsPanel = useCallback(() => {
    setPinsPanelOpen((prev) => {
      if (!prev) loadPins();
      return !prev;
    });
  }, [loadPins]);

  // ── Edit handler ──

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!currentChannelId) return;
    try {
      await api.editMessage(currentChannelId, messageId, content);
      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m
      ));
      socket.pushMessageEdit(currentChannelId, messageId, content);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to edit message", duration: 2 });
    }
  }, [currentChannelId]);

  const handleDeleteChannel = useCallback(async (channelId: string) => {
    if (!activeServerId) return;

    if (usingMockData) {
      setChannels((prev) => prev.filter((channel) => channel.id !== channelId));
      if (route.kind === "channel" && route.channelId === channelId) {
        routerStore.openGuild(activeServerId);
      }
      Toast.success({ content: "Channel deleted", duration: 1.5 });
      return;
    }

    try {
      await api.deleteChannel(activeServerId, channelId);
      setChannels((prev) => prev.filter((channel) => channel.id !== channelId));
      if (route.kind === "channel" && route.channelId === channelId) {
        routerStore.openGuild(activeServerId);
      }
      Toast.success({ content: "Channel deleted", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to delete channel", duration: 2 });
    }
  }, [activeServerId, route, usingMockData]);

  const handleCreateServer = useCallback(async () => {
    if (!newServerName.trim()) return;
    try {
      const server = await api.createServer(newServerName.trim());
      setServers((prev) => [...prev, server]);
      routerStore.openGuild(server.id);
      setNewServerName("");
      setShowAddServer(false);
    } catch (err: any) {
      Toast.error(err.message);
    }
  }, [newServerName]);

  const handleCreateChannel = useCallback(async () => {
    if (!newChannelName.trim() || !activeServerId) return;
    try {
      const channel = await api.createChannel(activeServerId, newChannelName.trim(), newChannelType);
      setChannels((prev) => [...prev, channel]);
      routerStore.openChannel(activeServerId, channel.id);
      setNewChannelName("");
      setNewChannelType("text");
      setShowAddChannel(false);
    } catch (err: any) {
      Toast.error(err.message);
    }
  }, [activeServerId, newChannelName, newChannelType]);

  const handleDmHome = useCallback(() => {
    routerStore.openDmHome();
    setNavDrawerOpen(false);
  }, []);

  const handleSelectServer = useCallback((serverId: string) => {
    routerStore.openGuild(serverId);
    setNavDrawerOpen(false);
    setDetailDrawerOpen(false);
  }, []);

  const handleSelectDm = useCallback((dmId: string) => {
    routerStore.openDm(dmId);
    setNavDrawerOpen(false);
  }, []);

  const handleSelectChannel = useCallback((channelId: string) => {
    if (!activeServerId) return;
    routerStore.openChannel(activeServerId, channelId);
    setNavDrawerOpen(false);
  }, [activeServerId]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setNavDrawerOpen(false);
    setDetailDrawerOpen(false);
  }, []);

  const handleOpenServerSettings = useCallback(() => {
    setShowServerSettings(true);
    setNavDrawerOpen(false);
  }, []);

  const handleCloseShellDrawers = useCallback(() => {
    setNavDrawerOpen(false);
    setDetailDrawerOpen(false);
  }, []);

  const handleStartCall = useCallback((type: "voice" | "video") => {
    if (!activeDmId) return;
    const dm = dmConversations.find((conversation) => conversation.id === activeDmId);
    if (!dm) return;
    setCallState({
      active: true,
      type,
      peerId: dm.userId,
      peerName: dm.displayName,
      peerAvatar: dm.avatarUrl,
    });
    Toast.info({ content: `Starting ${type} call with ${dm.displayName}...`, duration: 2 });
  }, [activeDmId, dmConversations]);

  const handleEndCall = useCallback(() => {
    setCallState(null);
    Toast.info({ content: "Call ended", duration: 1.5 });
  }, []);

  const handleNewDmSearch = useCallback(async (query: string) => {
    setNewDmSearch(query);
    if (query.trim().length === 0) {
      setNewDmResults([]);
      return;
    }
    try {
      const results = await api.searchUsers(query.trim());
      setNewDmResults(results);
    } catch {
      setNewDmResults([]);
    }
  }, []);

  const handleStartDm = useCallback(async (userId: string) => {
    try {
      const conversation = await api.createDMConversation(userId);
      const dmEntry = toDmConversation(conversation);
      setDmConversations((prev) => {
        if (prev.some((dm) => dm.id === dmEntry.id)) return prev;
        return [dmEntry, ...prev];
      });
      routerStore.openDm(dmEntry.id);
      setShowNewDm(false);
      setNewDmSearch("");
      setNewDmResults([]);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to start DM", duration: 2 });
    }
  }, []);

  useEffect(() => {
    if (!pendingFocusMessage || !historyReadyKey) return;
    const expectedKey = `${pendingFocusMessage.streamKind}:${pendingFocusMessage.streamId}`;
    if (historyReadyKey !== expectedKey) return;

    const focusedPayload = toMessagePayload(pendingFocusMessage.message);
    setMessages((prev) => {
      if (prev.some((item) => item.id === focusedPayload.id)) return prev;
      return sortMessagesChronologically([...prev, focusedPayload]);
    });

    window.setTimeout(() => {
      messageReplyStore.highlightMessage(focusedPayload.id);
      document.getElementById(`msg-${focusedPayload.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    setPendingFocusMessage(null);
  }, [historyReadyKey, pendingFocusMessage]);

  const handleOpenFavoriteRoute = useCallback((routeHash: string) => {
    const target = parseRoute(routeHash);
    switch (target.kind) {
      case "dmHome":
        routerStore.openDmHome();
        break;
      case "dmConversation":
        routerStore.openDm(target.conversationId);
        break;
      case "notifications":
        routerStore.openNotifications();
        break;
      case "favorites":
        routerStore.openFavorites();
        break;
      case "bookmarks":
        routerStore.openBookmarks();
        break;
      case "mentions":
        routerStore.openMentions();
        break;
      case "you":
        routerStore.openYou();
        break;
      case "guildHome":
        routerStore.openGuild(target.guildId);
        break;
      case "channel":
        routerStore.openChannel(target.guildId, target.channelId);
        break;
    }
  }, []);

  const openMessageContext = useCallback((stream: api.StreamContextRead, message: api.MessageRead) => {
    setPendingFocusMessage({
      streamKind: stream.stream_kind,
      streamId: String(stream.stream_id),
      guildId: stream.server_id ? String(stream.server_id) : null,
      message,
    });
    if (stream.stream_kind === "dm") {
      routerStore.openDm(String(stream.stream_id));
      return;
    }
    if (stream.server_id) {
      routerStore.openChannel(String(stream.server_id), String(stream.stream_id));
    }
  }, []);

  const handleNotificationSelect = useCallback(async (item: api.NotificationRead) => {
    if (item.notification_type !== "dm_unread_summary" && item.read_at == null) {
      try {
        await api.markNotificationRead(item.id);
      } catch (err) {
        console.warn("[Proteus] Failed to mark notification read:", err);
      }
    }
    if (item.message) {
      openMessageContext(item.stream, item.message);
    } else if (item.stream.stream_kind === "dm") {
      routerStore.openDm(String(item.stream.stream_id));
    } else if (item.stream.server_id) {
      routerStore.openChannel(String(item.stream.server_id), String(item.stream.stream_id));
    }
    refreshInbox();
    loadDmConversations();
  }, [loadDmConversations, openMessageContext, refreshInbox]);

  const handleMarkNotificationRead = useCallback(async (item: api.NotificationRead) => {
    if (item.notification_type === "dm_unread_summary" || item.read_at != null) return;
    try {
      await api.markNotificationRead(item.id);
      refreshInbox();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to mark notification read", duration: 2 });
    }
  }, [refreshInbox]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      loadDmConversations();
      await refreshInbox();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to clear inbox", duration: 2 });
    }
  }, [loadDmConversations, refreshInbox]);

  const handleSelectSearchResult = useCallback((result: api.MessageSearchResultRead) => {
    search.setOpen(false);
    openMessageContext(result.stream, result.message);
  }, [openMessageContext, search]);

  const activeServer = servers.find((server) => server.id === activeServerId);
  const activeChannel = channels.find((channel) => channel.id === activeChannelId);
  const activeDm = dmConversations.find((conversation) => conversation.id === activeDmId);

  const canManageChannels = hasPermission(myPermissions, Permissions.MANAGE_CHANNELS);
  const canManageMessages = hasPermission(myPermissions, Permissions.MANAGE_MESSAGES);
  const canOpenServerSettings = hasPermission(myPermissions, Permissions.MANAGE_SERVER)
    || hasPermission(myPermissions, Permissions.MANAGE_CHANNELS)
    || hasPermission(myPermissions, Permissions.MANAGE_ROLES);

  const members = usingMockData
    ? MOCK_MEMBERS
    : [{
      id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.display_name,
      avatar_url: currentUser.avatar_url,
      status: (currentUser.status || "online") as "online" | "idle" | "dnd" | "offline",
      status_message: currentUser.status_message,
    }];

  const userMap = useMemo(() => {
    const nextMap: Record<string, string> = {};
    nextMap[currentUser.id] = currentUser.display_name || currentUser.username;
    for (const member of members) {
      nextMap[member.id] = member.display_name || member.username;
    }
    for (const conversation of dmConversations) {
      nextMap[conversation.userId] = conversation.displayName;
    }
    return nextMap;
  }, [currentUser.display_name, currentUser.id, currentUser.username, dmConversations, members]);

  const localNotificationCount = dmConversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0);
  const notificationCount = flags.inbox && inbox.summary
    ? inbox.summary.total_unread
    : localNotificationCount;
  const favoriteCount = favoriteEntries.length;
  const isCurrentFavorite = activeServerId && activeChannelId
    ? favoritesStore.isChannelFavorited(activeServerId, activeChannelId)
    : activeDmId
      ? favoritesStore.isDmFavorited(activeDmId)
      : false;

  const handleToggleFavorite = useCallback(async () => {
    if (flags.savedItems && savedItemsAvailable) {
      try {
        if (activeServerId && activeChannel) {
          if (favoritesStore.isChannelFavorited(activeServerId, activeChannel.id)) {
            await api.unsaveItem("channel", activeChannel.id);
          } else {
            await api.saveItem("channel", activeChannel.id);
          }
          await refreshSavedItems(false);
          return;
        }
        if (activeDm) {
          if (favoritesStore.isDmFavorited(activeDm.id)) {
            await api.unsaveItem("dm", activeDm.id);
          } else {
            await api.saveItem("dm", activeDm.id);
          }
          await refreshSavedItems(false);
        }
        return;
      } catch (err: any) {
        Toast.error({ content: err.message || "Failed to update favorites", duration: 2 });
      }
    }

    if (activeServerId && activeChannel) {
      favoritesStore.toggleChannel(
        activeServerId,
        activeChannel.id,
        `#${activeChannel.name}`,
        activeServer?.name || "Server channel",
      );
      return;
    }
    if (activeDm) {
      favoritesStore.toggleDm(
        activeDm.id,
        activeDm.displayName,
        `Direct message with @${activeDm.username}`,
      );
    }
  }, [activeDm, activeChannel, activeServer, activeServerId, flags.savedItems, refreshSavedItems, savedItemsAvailable]);

  const textChannels = channels.filter((channel) => channel.channel_type === "text");
  const voiceChannels = channels.filter((channel) => channel.channel_type === "voice");
  const searchScopeOptions = useMemo<MessageSearchScopeOption[]>(() => {
    const options: MessageSearchScopeOption[] = [{ value: "global", label: "Global" }];
    if (activeServerId) {
      options.unshift({ value: "server", label: "This Server" });
    }
    if (activeChannelId) {
      options.unshift({ value: "channel", label: "This Channel" });
    }
    if (activeDmId) {
      options.unshift({ value: "dm", label: "This DM" });
    }
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [activeChannelId, activeDmId, activeServerId]);
  const searchTargetLabel = useMemo(() => {
    if (search.scope === "channel") {
      return activeChannel ? `#${activeChannel.name}` : "this channel";
    }
    if (search.scope === "server") {
      return activeServer?.name || "this server";
    }
    if (search.scope === "dm") {
      return activeDm?.displayName || "this direct message";
    }
    return "all accessible conversations";
  }, [activeChannel, activeDm, activeServer, search.scope]);

  const dmHomeCards: WorkspaceCardItem[] = [
    {
      title: "Start a DM",
      description: "Open a new conversation without leaving the current shell.",
      icon: "plus",
      meta: "Janus-backed conversations",
      onClick: () => setShowNewDm(true),
    },
    {
      title: "Favorites",
      description: "Save high-signal DMs and channels so they stay one click away.",
      icon: "star",
      meta: `${favoriteCount} saved`,
      onClick: () => routerStore.openFavorites(),
    },
    {
      title: "Notifications",
      description: "Track mentions, replies, and unread DM summaries from the new Janus-backed inbox.",
      icon: "bell",
      meta: notificationCount > 0 ? `${notificationCount} unread` : "Inbox synced",
      onClick: () => routerStore.openNotifications(),
    },
    {
      title: "Quick Switcher",
      description: "Jump between servers, channels, settings, and DMs with a keyboard-first command palette.",
      icon: "magnifying-glass",
      meta: "Cmd/Ctrl + K",
      onClick: () => setCommandPaletteOpen(true),
    },
  ];

  const dmHomeListItems: WorkspaceListItem[] = dmConversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.displayName,
    subtitle: conversation.lastMessage || `@${conversation.username}`,
    icon: "at",
    meta: conversation.unreadCount ? `${conversation.unreadCount} new` : conversation.status,
    onClick: () => handleSelectDm(conversation.id),
  }));

  const friendRelationships = useMemo(
    () => relationships.filter((relationship) => relationship.relationship_type === api.RelationshipType.FRIEND),
    [relationships],
  );

  // Build active friends list from actual relationships instead of DM heuristics.
  const activeFriends: ActiveFriend[] = useMemo(() => {
    return friendRelationships.map((relationship) => ({
      id: relationship.peer_id,
      username: relationship.peer_username || "unknown",
      displayName: relationship.nickname || relationship.peer_display_name || relationship.peer_username || "Unknown",
      avatarUrl: relationship.peer_avatar_url || null,
      status: ((relationship.peer_status || "offline") as ActiveFriend["status"]),
      statusMessage: null,
    }));
  }, [friendRelationships]);

  const handleActiveNowSelectFriend = useCallback((userId: string) => {
    const conversation = dmConversations.find((c) => c.userId === userId);
    if (conversation) {
      handleSelectDm(conversation.id);
    }
  }, [dmConversations, handleSelectDm]);

  const favoritesCards: WorkspaceCardItem[] = [
    {
      title: "Saved Channels",
      description: "Route-backed favorites already work locally and are ready to graduate into synced bookmarks.",
      icon: "hash",
      meta: `${favoriteEntries.filter((entry) => entry.kind === "channel").length} channels`,
    },
    {
      title: "Saved DMs",
      description: "Pinned direct messages stay close even while richer inbox and read-state services are still being built.",
      icon: "at",
      meta: `${favoriteEntries.filter((entry) => entry.kind === "dm").length} DMs`,
    },
    {
      title: "Command Palette",
      description: "Favorites also surface in the quick switcher so local keyboard navigation feels closer to Rival already.",
      icon: "magnifying-glass",
      meta: "Desktop-first shortcut",
      onClick: () => setCommandPaletteOpen(true),
    },
  ];

  const favoritesListItems: WorkspaceListItem[] = favoriteEntries.map((entry) => ({
    id: entry.id,
    title: entry.label,
    subtitle: entry.subtitle,
    icon: entry.icon,
    meta: entry.kind === "channel" ? "Channel" : "Direct message",
    onClick: () => handleOpenFavoriteRoute(entry.routeHash),
  }));

  const guildCards: WorkspaceCardItem[] = [];
  if (textChannels[0] && activeServerId) {
    guildCards.push({
      title: `Open #${textChannels[0].name}`,
      description: "Land directly in the main conversation surface for this server.",
      icon: "hash",
      meta: textChannels[0].topic || "Primary text channel",
      onClick: () => routerStore.openChannel(activeServerId, textChannels[0].id),
    });
  }
  if (canManageChannels) {
    guildCards.push({
      title: "Create Channel",
      description: "Provision a new text or voice room from the server overview.",
      icon: "plus",
      meta: "Manage Channels permission",
      onClick: () => setShowAddChannel(true),
    });
  }
  if (canOpenServerSettings) {
    guildCards.push({
      title: "Server Settings",
      description: "Open roles, invites, overview, and future parity controls for this guild.",
      icon: "gear",
      meta: "Management surface",
      onClick: handleOpenServerSettings,
    });
  }
  if (voiceChannels[0] && activeServerId) {
    guildCards.push({
      title: `Enter ${voiceChannels[0].name}`,
      description: "Use the same routed shell to grow into richer LiveKit-backed voice surfaces.",
      icon: "speaker-high",
      meta: "Voice foundation",
      onClick: () => routerStore.openChannel(activeServerId, voiceChannels[0].id),
    });
  }

  const guildListItems: WorkspaceListItem[] = channels.map((channel) => ({
    id: channel.id,
    title: channel.name,
    subtitle: channel.topic || (channel.channel_type === "voice" ? "Voice channel" : "Text channel"),
    icon: channel.channel_type === "voice" ? "speaker-high" : "hash",
    active: activeChannelId === channel.id,
    onClick: () => handleSelectChannel(channel.id),
  }));

  let utilityView: UtilityView | null = null;

  if (route.kind === "dmHome") {
    utilityView = {
      title: "Friends",
      topic: "Friends list, requests, and add friend",
      actionTooltip: "New Direct Message",
      actionIcon: "plus",
      onAction: () => setShowNewDm(true),
      page: (
        <FriendsView
          currentUserId={currentUser.id}
          onOpenDm={(userId) => {
            const existing = dmConversations.find((dm) => dm.userId === userId);
            if (existing) {
              routerStore.openDm(existing.id);
            }
          }}
          onOpenServer={(serverId) => {
            const srv = servers.find((s) => s.id === serverId);
            if (srv) {
              routerStore.openServer(serverId, channels.find((c) => c.server_id === serverId)?.id || "");
            }
          }}
        />
      ),
      sidebar: (
        <ActiveNowSidebar
          activeFriends={activeFriends}
          onSelectFriend={handleActiveNowSelectFriend}
        />
      ),
    };
  } else if (route.kind === "notifications") {
    utilityView = {
      title: "Notifications",
      topic: "Inbox and unread summaries",
      actionTooltip: "Open Quick Switcher",
      actionIcon: "magnifying-glass",
      onAction: () => setCommandPaletteOpen(true),
      page: (
        <NotificationInbox
          items={inbox.notifications}
          summary={inbox.summary}
          loading={inbox.loading}
          error={inbox.error}
          filter={inbox.filter}
          onFilterChange={inbox.setFilter}
          onSelect={handleNotificationSelect}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
        />
      ),
    };
  } else if (route.kind === "favorites") {
    utilityView = {
      title: "Favorites",
      topic: "Saved routes and bookmarks",
      actionTooltip: "Open Quick Switcher",
      actionIcon: "magnifying-glass",
      onAction: () => setCommandPaletteOpen(true),
      page: (
        <WorkspacePage
          eyebrow="Favorites"
          title="Keep high-signal spaces close"
          description={savedItemsAvailable
            ? "Favorites are now synced to Janus so saved channels and DMs persist across sessions without losing the lightweight desktop feel."
            : "Favorites still fall back cleanly to local storage whenever the saved-items API is unavailable."}
          heroActionLabel="Back to DMs"
          heroActionIcon="chats-circle"
          onHeroAction={() => routerStore.openDmHome()}
          heroStats={[
            { label: "Saved", value: String(favoriteCount) },
            { label: "Channels", value: String(favoriteEntries.filter((entry) => entry.kind === "channel").length) },
            { label: "DMs", value: String(favoriteEntries.filter((entry) => entry.kind === "dm").length) },
          ]}
          cardsTitle="How Favorites Help"
          cardsHint="Desktop-native shortcuts that already separate Proteus from a standard web clone"
          cards={favoritesCards}
          listTitle="Saved Routes"
          listHint="Each entry preserves the destination hash so navigation stays instant"
          listItems={favoritesListItems}
          emptyTitle="Nothing has been saved yet"
          emptyDescription="Star a DM or channel in the chat header and it will show up here immediately."
        />
      ),
    };
  } else if (route.kind === "bookmarks") {
    utilityView = {
      title: "Bookmarks",
      topic: "Saved channels, DMs, and messages",
      actionTooltip: "Open Quick Switcher",
      actionIcon: "magnifying-glass",
      onAction: () => setCommandPaletteOpen(true),
      page: (
        <BookmarksView
          onNavigate={handleOpenFavoriteRoute}
          onRemove={() => refreshSavedItems(false)}
        />
      ),
    };
  } else if (route.kind === "mentions") {
    utilityView = {
      title: "Mentions",
      topic: "Recent @mentions across all servers",
      actionTooltip: "Open Quick Switcher",
      actionIcon: "magnifying-glass",
      onAction: () => setCommandPaletteOpen(true),
      page: (
        <MentionsView onNavigate={openMessageContext} />
      ),
    };
  } else if (route.kind === "you") {
    utilityView = {
      title: "Profile",
      topic: "Your account overview",
      actionTooltip: "Edit Profile",
      actionIcon: "pencil-simple",
      onAction: () => setShowSettings(true),
      page: (
        <ProfileView
          currentUser={currentUser}
          onEditSettings={() => setShowSettings(true)}
          onOpenNotifications={() => routerStore.openNotifications()}
          onOpenFavorites={() => routerStore.openFavorites()}
          onOpenServer={(serverId) => routerStore.openGuild(serverId)}
        />
      ),
    };
  } else if (route.kind === "guildHome" && activeServer) {
    utilityView = {
      title: activeServer.name,
      topic: "Server overview",
      actionTooltip: canManageChannels ? "Create Channel" : "Open Server Settings",
      actionIcon: canManageChannels ? "plus" : "gear",
      onAction: canManageChannels ? () => setShowAddChannel(true) : canOpenServerSettings ? handleOpenServerSettings : undefined,
      page: (
        <WorkspacePage
          eyebrow="Server Overview"
          title={activeServer.name}
          description="This guild landing surface moves Proteus away from a single-screen chat app and toward Rival’s richer route model, while still keeping the interface fully responsive to Proteus theme tokens."
          heroActionLabel={textChannels[0] ? `Open #${textChannels[0].name}` : canManageChannels ? "Create Channel" : undefined}
          heroActionIcon={textChannels[0] ? "hash" : "plus"}
          onHeroAction={textChannels[0] ? () => handleSelectChannel(textChannels[0].id) : canManageChannels ? () => setShowAddChannel(true) : undefined}
          heroStats={[
            { label: "Channels", value: String(channels.length) },
            { label: "Text Rooms", value: String(textChannels.length) },
            { label: "Voice Rooms", value: String(voiceChannels.length) },
          ]}
          cardsTitle="Guild Shortcuts"
          cardsHint="Actions that make the route shell feel intentional instead of transitional"
          cards={guildCards}
          listTitle="Channels"
          listHint="Use the overview as a routed landing page before opening a specific room"
          listItems={guildListItems}
          emptyTitle="This server has no channels yet"
          emptyDescription="Create the first channel to bring this guild to life."
        />
      ),
    };
  }

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [
      {
        id: "utility-dms",
        title: "Direct Messages",
        subtitle: "Open the DM home surface",
        icon: "chats-circle",
        keywords: ["friends", "dm", "messages", "home"],
        hint: "Route",
        onSelect: () => routerStore.openDmHome(),
      },
      {
        id: "utility-notifications",
        title: "Notifications",
        subtitle: "Open the parity inbox scaffold",
        icon: "bell",
        keywords: ["mentions", "alerts", "inbox"],
        hint: "Route",
        onSelect: () => routerStore.openNotifications(),
      },
      {
        id: "utility-favorites",
        title: "Favorites",
        subtitle: "Open saved routes and bookmarks",
        icon: "star",
        keywords: ["bookmarks", "saved", "pins"],
        hint: "Route",
        onSelect: () => routerStore.openFavorites(),
      },
      {
        id: "utility-settings",
        title: "User Settings",
        subtitle: "Open the Proteus control center",
        icon: "gear",
        keywords: ["preferences", "account", "theme"],
        hint: "Panel",
        onSelect: handleOpenSettings,
      },
    ];

    if (flags.messageSearch) {
      items.splice(3, 0, {
        id: "utility-message-search",
        title: "Search Messages",
        subtitle: "Open the real message search surface",
        icon: "magnifying-glass",
        keywords: ["search", "find", "history", "messages"],
        hint: "Search",
        onSelect: () => openMessageSearch(),
      });
    }

    for (const conversation of dmConversations) {
      items.push({
        id: `dm-${conversation.id}`,
        title: conversation.displayName,
        subtitle: conversation.lastMessage || `Direct message with @${conversation.username}`,
        icon: "at",
        keywords: [conversation.username, conversation.displayName, "dm", "direct message"],
        hint: "DM",
        onSelect: () => routerStore.openDm(conversation.id),
      });
    }

    for (const favorite of favoriteEntries) {
      items.push({
        id: `favorite-${favorite.id}`,
        title: favorite.label,
        subtitle: favorite.subtitle,
        icon: favorite.icon,
        keywords: ["favorite", "saved", favorite.label, favorite.subtitle],
        hint: "Saved",
        onSelect: () => handleOpenFavoriteRoute(favorite.routeHash),
      });
    }

    for (const server of servers) {
      items.push({
        id: `server-${server.id}`,
        title: server.name,
        subtitle: "Open server overview",
        icon: "users",
        keywords: [server.name, "server", "guild"],
        hint: "Server",
        onSelect: () => routerStore.openGuild(server.id),
      });
    }

    for (const channel of channels) {
      if (!activeServerId) break;
      items.push({
        id: `channel-${channel.id}`,
        title: channel.channel_type === "voice" ? channel.name : `#${channel.name}`,
        subtitle: activeServer?.name || "Channel",
        icon: channel.channel_type === "voice" ? "speaker-high" : "hash",
        keywords: [channel.name, channel.channel_type, activeServer?.name || "server"],
        hint: channel.channel_type === "voice" ? "Voice" : "Channel",
        onSelect: () => routerStore.openChannel(activeServerId, channel.id),
      });
    }

    return items;
  }, [
    activeServer?.name,
    activeServerId,
    channels,
    dmConversations,
    favoriteEntries,
    flags.messageSearch,
    handleOpenFavoriteRoute,
    handleOpenSettings,
    openMessageSearch,
    servers,
  ]);

  const chatChannelName = isDmConversationRoute
    ? (activeDm?.displayName || "Direct Messages")
    : (activeChannel?.name || "");
  const chatChannelTopic = isChannelRoute ? activeChannel?.topic : null;
  const showChat = isDmConversationRoute ? !!activeDm : isChannelRoute ? !!activeChannel : false;
  const shouldUseNavDrawer = layoutMode === "tablet" || layoutMode === "compact";
  const shouldUseDetailDrawer = layoutMode !== "desktop";

  const channelSidebar = dmShellMode ? (
    <ChannelList
      serverName="Direct Messages"
      serverId=""
      channels={[]}
      activeChannelId={null}
      currentUser={currentUser}
      onSelect={() => {}}
      onOpenSettings={handleOpenSettings}
      dmMode
      dmConversations={dmConversations}
      activeDmId={activeDmId}
      onSelectDm={handleSelectDm}
      onNewDm={() => setShowNewDm(true)}
      voiceConnected={!!callState}
      voiceChannelName={callState ? `Call — ${callState.peerName}` : undefined}
      onDisconnectVoice={handleEndCall}
    />
  ) : activeServer ? (
    <ChannelList
      serverName={activeServer.name}
      serverId={activeServer.id}
      channels={channels}
      activeChannelId={activeChannelId}
      currentUser={currentUser}
      onSelect={handleSelectChannel}
      onAddChannel={() => setShowAddChannel(true)}
      onOpenSettings={handleOpenSettings}
      onOpenServerSettings={handleOpenServerSettings}
      onDeleteChannel={handleDeleteChannel}
      canManageChannels={canManageChannels}
      canOpenServerSettings={canOpenServerSettings}
    />
  ) : null;

  const detailPanel = isDmConversationRoute ? (
    activeDm ? (
      <div className="dm-profile-sidebar">
        <div className="dm-profile-sidebar__header">
          <div className="dm-profile-sidebar__avatar-wrap">
            {activeDm.avatarUrl ? (
              <img className="dm-profile-sidebar__avatar" src={activeDm.avatarUrl} alt="" />
            ) : (
              <div className="dm-profile-sidebar__avatar dm-profile-sidebar__avatar--fallback">
                {activeDm.displayName[0].toUpperCase()}
              </div>
            )}
            <span className={`dm-profile-sidebar__status dm-profile-sidebar__status--${activeDm.status}`} />
          </div>
          <div className="dm-profile-sidebar__name">{activeDm.displayName}</div>
          <div className="dm-profile-sidebar__username">{activeDm.username}</div>
        </div>
        <div className="dm-profile-sidebar__section">
          <div className="dm-profile-sidebar__section-title">Member Since</div>
          <div className="dm-profile-sidebar__section-content">Jan 1, 2025</div>
        </div>
        <div className="dm-profile-sidebar__section">
          <div className="dm-profile-sidebar__section-title">Note</div>
          <input
            className="dm-profile-sidebar__note-input"
            placeholder="Click to add a note"
          />
        </div>
      </div>
    ) : null
  ) : isChannelRoute && activeServer ? (
    <MemberList members={members} />
  ) : null;

  const showDetailToggle = shouldUseDetailDrawer && !!detailPanel;
  const isDrawerActive = (shouldUseNavDrawer && navDrawerOpen) || (showDetailToggle && detailDrawerOpen);
  const activeUtility = route.kind === "notifications"
    ? "notifications"
    : route.kind === "favorites"
      ? "favorites"
      : route.kind === "bookmarks"
        ? "bookmarks"
        : route.kind === "mentions"
          ? "mentions"
          : route.kind === "you"
            ? "you"
            : route.kind === "dmHome" || route.kind === "dmConversation"
              ? "dm"
              : null;

  return (
    <div className="app-layout" data-layout-mode={layoutMode} data-has-aux-panel={detailPanel ? "true" : undefined}>
      <div className="titlebar-drag" />
      {isDrawerActive && <div className="app-layout__scrim" onClick={handleCloseShellDrawers} />}

      <div
        className={`app-layout__primary-nav ${shouldUseNavDrawer ? "app-layout__primary-nav--drawer" : ""} ${navDrawerOpen ? "app-layout__primary-nav--open" : ""}`}
      >
        <ServerList
          servers={servers}
          activeServerId={activeServerId}
          dmMode={route.kind === "dmHome" || route.kind === "dmConversation"}
          activeUtility={activeUtility}
          notificationCount={notificationCount}
          favoriteCount={favoriteCount}
          onSelect={handleSelectServer}
          onAdd={() => setShowAddServer(true)}
          onDmHome={handleDmHome}
          onNotifications={() => routerStore.openNotifications()}
          onFavorites={() => routerStore.openFavorites()}
          onBookmarks={() => routerStore.openBookmarks()}
          onMentions={() => routerStore.openMentions()}
          onYou={() => routerStore.openYou()}
        />
        {channelSidebar}
      </div>

      <div className="app-layout__workspace">
        {showChat ? (
          <div className="chat-area">
            <ChatView
              channelId={currentChannelId}
              channelName={chatChannelName}
              channelTopic={chatChannelTopic}
              messages={messages}
              userMap={userMap}
              currentUserId={currentUser.id}
              onDeleteMessage={handleDeleteMessage}
              onReportMessage={handleReportMessage}
              canManageMessages={canManageMessages}
              isDm={isDmConversationRoute}
              onVoiceCall={() => handleStartCall("voice")}
              onVideoCall={() => handleStartCall("video")}
              showNavigationToggle={shouldUseNavDrawer}
              onToggleNavigation={() => setNavDrawerOpen((prev) => !prev)}
              showDetailsToggle={showDetailToggle}
              onToggleDetails={() => setDetailDrawerOpen((prev) => !prev)}
              isFavorite={isCurrentFavorite}
              onToggleFavorite={handleToggleFavorite}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenMessageSearch={openMessageSearch}
              onReactionAdd={handleReactionAdd}
              onReactionRemove={handleReactionRemove}
              onPinMessage={handlePinMessage}
              onUnpinMessage={handleUnpinMessage}
              onEditMessage={handleEditMessage}
              pinnedMessages={pinnedMessages}
              pinsLoading={pinsLoading}
              onTogglePinsPanel={handleTogglePinsPanel}
              pinsPanelOpen={pinsPanelOpen}
              onBookmarkMessage={async (messageId) => {
                try {
                  await api.saveItem("message", messageId);
                  Toast.success({ content: "Message bookmarked", duration: 1.5 });
                } catch {
                  Toast.error({ content: "Failed to bookmark message", duration: 2 });
                }
              }}
            />
            <TypingIndicator typingUsers={typingUsers} />
            <MessageInput
              channelId={isDmConversationRoute ? (activeDmId || "") : (activeChannel?.id || "")}
              channelName={chatChannelName}
              onMessageSent={handleMessageSent}
              mockMode={usingMockData && isChannelRoute}
              wsConnected={hermesConnected}
              senderId={currentUser.id}
              senderName={currentUser.display_name || currentUser.username}
              onOpenGamelets={() => setShowGameletLibrary(true)}
              dmMode={isDmConversationRoute}
            />

            {activeGamelet && (
              <GameletPlayer
                gameName={activeGamelet.name}
                gameUrl={activeGamelet.url}
                type={activeGamelet.type}
                gamepadMapping={activeGamelet.gamepadMapping}
                onLeave={() => setActiveGamelet(null)}
              />
            )}

            {callState && (
              <CallOverlay
                call={callState}
                onEnd={handleEndCall}
              />
            )}
          </div>
        ) : utilityView ? (
          <div className="chat-area">
            <div className="chat-area__header">
              {shouldUseNavDrawer && (
                <Tooltip content="Toggle Navigation" position="bottom">
                  <div
                    className="chat-area__header__action-btn chat-area__header__action-btn--shell"
                    onClick={() => setNavDrawerOpen((prev) => !prev)}
                  >
                    <PhIcon name="sidebar" size={20} />
                  </div>
                </Tooltip>
              )}
              <span className="chat-area__header__name">{utilityView.title}</span>
              {utilityView.topic && (
                <span className="chat-area__header__topic">{utilityView.topic}</span>
              )}
              <div className="chat-area__header__actions">
                {utilityView.onAction && utilityView.actionTooltip && utilityView.actionIcon && (
                  <Tooltip content={utilityView.actionTooltip} position="bottom">
                    <div className="chat-area__header__action-btn" onClick={utilityView.onAction}>
                      <PhIcon name={utilityView.actionIcon} size={20} />
                    </div>
                  </Tooltip>
                )}
                <Tooltip content="Quick Switcher" position="bottom">
                  <div className="chat-area__header__action-btn" onClick={() => setCommandPaletteOpen(true)}>
                    <PhIcon name="magnifying-glass" size={20} />
                  </div>
                </Tooltip>
                <Tooltip content="User Settings" position="bottom">
                  <div className="chat-area__header__action-btn" onClick={handleOpenSettings}>
                    <PhIcon name="gear" size={20} />
                  </div>
                </Tooltip>
              </div>
            </div>
            <div className="chat-area__utility-container">
              <div className="chat-area__utility-body">
                {utilityView.page}
              </div>
              {utilityView.sidebar}
            </div>
          </div>
        ) : (
          <div className="chat-area">
            <div className="chat-area__empty">
              {servers.length === 0 ? "Create a server to get started" : "Select a channel or conversation"}
            </div>
          </div>
        )}
      </div>

      {detailPanel && (
        <div
          className={`app-layout__aux-panel ${showDetailToggle ? "app-layout__aux-panel--drawer" : ""} ${detailDrawerOpen ? "app-layout__aux-panel--open" : ""}`}
        >
          {detailPanel}
        </div>
      )}

      <CommandPalette
        open={commandPaletteOpen}
        items={commandPaletteItems}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <MessageSearchModal
        open={search.open}
        query={search.query}
        scope={search.scope}
        scopeOptions={searchScopeOptions}
        results={search.results}
        loading={search.loading}
        error={search.error}
        nextCursor={search.nextCursor}
        targetLabel={searchTargetLabel}
        filters={search.filters}
        userMap={userMap}
        onClose={() => search.setOpen(false)}
        onQueryChange={search.setQuery}
        onScopeChange={search.setScope}
        onSelectResult={handleSelectSearchResult}
        onLoadMore={search.nextCursor ? search.loadMore : undefined}
        onFiltersChange={search.setFilters}
      />

      <Modal
        title="Create Server"
        visible={showAddServer}
        onOk={handleCreateServer}
        onCancel={() => setShowAddServer(false)}
        okText="Create"
        cancelText="Cancel"
        maskClosable={false}
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <Input
          value={newServerName}
          onChange={setNewServerName}
          placeholder="Server name"
          onKeyDown={(event) => event.key === "Enter" && handleCreateServer()}
          autoFocus
        />
      </Modal>

      <Modal
        title="Create Channel"
        visible={showAddChannel}
        onOk={handleCreateChannel}
        onCancel={() => {
          setShowAddChannel(false);
          setNewChannelName("");
          setNewChannelType("text");
        }}
        okText="Create"
        cancelText="Cancel"
        maskClosable={false}
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            value={newChannelName}
            onChange={setNewChannelName}
            placeholder="Channel name"
            onKeyDown={(event) => event.key === "Enter" && handleCreateChannel()}
            autoFocus
          />
          <Select
            value={newChannelType}
            onChange={(value) => setNewChannelType(value as "text" | "voice")}
            style={{ width: "100%" }}
          >
            <Select.Option value="text">Text Channel</Select.Option>
            <Select.Option value="voice">Voice Channel</Select.Option>
          </Select>
        </div>
      </Modal>

      {showSettings && (
        <SettingsPanel
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onLogout={() => {
            setShowSettings(false);
            if (onLogout) onLogout();
          }}
          onUserUpdated={onUserUpdated}
        />
      )}

      {showServerSettings && activeServer && (
        <ServerSettingsPanel
          server={activeServer}
          currentUser={currentUser}
          myPermissions={myPermissions}
          onClose={() => setShowServerSettings(false)}
        />
      )}

      <GameletLibraryModal
        visible={showGameletLibrary}
        onClose={() => setShowGameletLibrary(false)}
        onSelect={(gamelet) => setActiveGamelet(gamelet)}
      />

      <Modal
        title="New Direct Message"
        visible={showNewDm}
        onCancel={() => {
          setShowNewDm(false);
          setNewDmSearch("");
          setNewDmResults([]);
        }}
        footer={null}
        maskClosable
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <Input
          value={newDmSearch}
          onChange={(value) => handleNewDmSearch(value)}
          placeholder="Search for a user..."
          autoFocus
        />
        <div style={{ marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
          {newDmResults.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 4px",
                cursor: "pointer",
                borderRadius: 4,
              }}
              className="channel-sidebar__dm-item"
              onClick={() => handleStartDm(user.id)}
            >
              <div className="channel-sidebar__dm-avatar-wrap">
                {user.avatar_url ? (
                  <img className="channel-sidebar__dm-avatar" src={user.avatar_url} alt="" />
                ) : (
                  <div className="channel-sidebar__dm-avatar channel-sidebar__dm-avatar--fallback">
                    {(user.display_name || user.username)[0].toUpperCase()}
                  </div>
                )}
                <span className={`channel-sidebar__dm-status channel-sidebar__dm-status--${user.status}`} />
              </div>
              <div>
                <div style={{ color: "var(--header-primary)", fontSize: 14 }}>
                  {user.display_name || user.username}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {user.username}
                </div>
              </div>
            </div>
          ))}
          {newDmSearch.trim() && newDmResults.length === 0 && (
            <div style={{ padding: 16, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>
              No users found
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
