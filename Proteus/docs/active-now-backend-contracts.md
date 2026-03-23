# Active Now Panel — Sibling-Team Backend Contracts

> **Status**: Frontend scaffolding complete. Backend support required from sibling teams.
>
> **Owner**: Proteus (frontend)
> **Date**: 2026-03-18

The Active Now sidebar is now live in the Proteus DM home view. It currently displays online DM contacts from the existing conversation list. To reach full Rival feature parity, the following backend capabilities must be implemented by sibling teams.

---

## 1. Presence Service (Hermes / New Service)

**Priority**: Critical
**Team**: Hermes (Real-Time Gateway)

The Rival's Active Now panel is driven by a real-time presence system that tracks user online/offline/idle/dnd status globally, not just within a single channel.

### Requirements

- **Gateway event**: `PRESENCE_UPDATE` — broadcast when a user's status changes.
  ```json
  {
    "event": "PRESENCE_UPDATE",
    "user_id": "<uuid>",
    "status": "online" | "idle" | "dnd" | "offline",
    "status_message": "<string | null>",
    "is_mobile": false
  }
  ```
- **Idle detection**: Server-side idle timeout (5 min default). If a user has an active socket but no interaction, transition status to `idle`.
- **Presence subscription model**: Proteus should be able to subscribe to presence updates for a set of user IDs (friends, guild members) rather than receiving all presence events globally. The Rival uses an LRU cache of 100 members per guild with a 5-minute TTL.
- **Initial presence state**: On socket connect, return the current presence of all friends/subscribed users so the client doesn't need to wait for individual updates.

### Proteus Integration Point

- `socket.ts` — listen for `presence_update` events on a new `presence:*` Phoenix channel or on the user's own channel.
- A new `PresenceStore` in Proteus will track `userId → status` and expose it to the Active Now sidebar and member lists.

---

## 2. Relationships / Friends System (Janus)

**Priority**: Critical
**Team**: Janus (Core API & Identity)

The Rival filters the Active Now panel to show only **friends**. Proteus currently uses DM conversations as a proxy for "contacts", but has no formal friend/relationship model.

### Requirements

- **`relationships` table**:
  ```
  id           UUID PK
  user_id      UUID FK → users
  target_id    UUID FK → users
  type         SMALLINT (1=FRIEND, 2=BLOCKED, 3=PENDING_INCOMING, 4=PENDING_OUTGOING)
  created_at   TIMESTAMPTZ
  ```
  Unique constraint on `(user_id, target_id)`.

- **REST endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | `GET` | `/api/v1/relationships` | List current user's relationships |
  | `POST` | `/api/v1/relationships` | Send friend request (creates PENDING pair) |
  | `PATCH` | `/api/v1/relationships/{id}` | Accept/decline friend request |
  | `DELETE` | `/api/v1/relationships/{id}` | Remove friend or unblock |
  | `GET` | `/api/v1/relationships/friends` | Shortcut: list only FRIEND-type relationships with user info |

- **Gateway events**: `RELATIONSHIP_ADD`, `RELATIONSHIP_REMOVE`, `RELATIONSHIP_UPDATE` — broadcast to both users in real time via Hermes.

### Proteus Integration Point

- `api.ts` — new relationship API functions.
- A new `RelationshipStore` to cache the friends list.
- Active Now sidebar will filter by `RelationshipStore.getFriends()` instead of DM contacts.

---

## 3. Voice State Tracking (Hermes)

**Priority**: High
**Team**: Hermes (Real-Time Gateway)

The Rival's primary content in the Active Now panel is **voice channel activity** — which friends are currently in voice, who's in the channel with them, and whether anyone is streaming.

### Requirements

- **Voice state broadcast**: When a user joins, leaves, or changes state in a voice channel, broadcast a `VOICE_STATE_UPDATE` to all users who have subscribed to that guild or who are friends with the user.
  ```json
  {
    "event": "VOICE_STATE_UPDATE",
    "guild_id": "<uuid | null>",
    "channel_id": "<uuid>",
    "user_id": "<uuid>",
    "connection_id": "<string>",
    "self_mute": false,
    "self_deaf": false,
    "self_video": false,
    "self_stream": false,
    "suppress": false
  }
  ```

- **Voice state query**: `GET /api/v1/voice/states` — return all voice states visible to the current user (friends in voice, members of shared guilds in voice).

- **Per-channel participant list**: The frontend needs to know all participants in a voice channel to render the avatar stack, not just the friend who triggered the update.

### Proteus Integration Point

- `socket.ts` — listen for `voice_state_update` events.
- A new `VoiceStateStore` will track `channelId → [VoiceState]` and derive the `voiceActivities` list passed to the Active Now sidebar.
- The `useActiveFriendVoiceStates()` hook equivalent will combine voice states with the friends list.

---

## 4. Stream Preview Service (New Service / Hermes)

**Priority**: Low (enhancement)
**Team**: Hermes or new media service

The Rival shows a 16:9 thumbnail preview when a friend is screen-sharing.

### Requirements

- **Stream preview endpoint**: `GET /api/v1/streams/{stream_key}/preview` — returns a JPEG/WebP thumbnail of the current stream frame.
- **Stream key format**: `{guild_id}:{channel_id}:{connection_id}` or `dm:{channel_id}:{connection_id}`.
- **Refresh interval**: Client polls every 10-15 seconds while the card is visible.
- **Permissions**: Only users with access to the voice channel should be able to fetch the preview.

### Proteus Integration Point

- The `VoiceActivityCard` component already has a placeholder structure for stream previews. Once the endpoint exists, add a `useStreamPreview(streamKey)` hook that polls periodically.

---

## 5. Privacy Preferences (Janus)

**Priority**: Medium
**Team**: Janus (Core API & Identity)

The Rival allows users to hide the Active Now panel via a privacy setting (`showActiveNow`).

### Requirements

- **User settings extension**: Add a `privacy_preferences` JSONB column to the `users` table (or a separate `user_settings` table).
  ```json
  {
    "show_active_now": true,
    "activity_status": true,
    "friend_requests_from": "everyone" | "friends_of_friends" | "server_members"
  }
  ```

- **REST endpoints**:
  | Method | Path | Description |
  |--------|------|-------------|
  | `GET` | `/api/v1/users/@me/settings` | Get user settings |
  | `PATCH` | `/api/v1/users/@me/settings` | Update user settings |

### Proteus Integration Point

- `PrivacyPreferencesStore` — local store backed by API.
- Active Now sidebar checks `showActiveNow` before rendering.
- Settings panel gets a "Privacy" section with toggles.

---

## 6. Member Presence Subscriptions (Hermes)

**Priority**: Medium
**Team**: Hermes (Real-Time Gateway)

For scalability, the Rival does not send all guild member presence updates. Instead, the client subscribes to specific member presence using an LRU model.

### Requirements

- **Subscription push**: Client sends `guild_subscribe` event with `{ guild_id, member_ids: [...] }` to receive presence updates for those members only.
- **LRU eviction**: Server maintains a per-guild cap (100 members default) and silently drops the oldest subscriptions.
- **TTL**: Subscriptions expire after 5 minutes without renewal.
- **Batch support**: Subscribe/unsubscribe to multiple members in one message.

### Proteus Integration Point

- `socket.ts` — add `subscribeGuildMembers(guildId, memberIds)` push helper.
- `MemberPresenceSubscriptionStore` — manages the LRU cache and auto-renews subscriptions for visible members (e.g., member list, Active Now entries).

---

## Implementation Priority Order

| Phase | Feature | Team | Dependency |
|-------|---------|------|------------|
| 1 | Relationships/Friends | Janus | None |
| 1 | Presence Service | Hermes | None |
| 2 | Voice State Tracking | Hermes | Presence |
| 2 | Privacy Preferences | Janus | None |
| 3 | Member Presence Subscriptions | Hermes | Presence |
| 4 | Stream Preview Service | Media/Hermes | Voice States |

Phase 1 is required for the Active Now panel to show **friends** (not just DM contacts) with **real-time status** (not just last-known from conversation list). Phase 2 unlocks the voice activity cards — the Rival's primary Active Now content. Phases 3-4 are scale and enhancement work.

---

## Current Proteus State

The frontend component (`ActiveNowSidebar`) is complete with:
- Empty state matching Rival's "It's quiet for now..." design
- Voice activity cards with avatar stacks, guild/channel context, join buttons
- Online friends list with status indicators and status messages
- Responsive collapse below 1100px viewport width
- CSS module styling matching Rival's 22rem fixed sidebar, card-based layout

The component accepts `activeFriends` and `voiceActivities` props — once the backend contracts above are fulfilled, the data flow is:

```
Gateway Events → Stores (Presence, VoiceState, Relationship) → ActiveNowSidebar props
```

No frontend changes beyond connecting the stores to the new API/gateway events.
