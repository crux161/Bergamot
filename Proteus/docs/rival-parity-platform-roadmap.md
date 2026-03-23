# Proteus vs Rival Parity Platform Roadmap

## Purpose

This document is the Proteus-side handoff for the wider Bergamot platform. It captures:

- the current Rival vs Proteus comparison
- the frontend work Proteus can own immediately
- the sibling-team contracts required for full Rival-level parity
- the areas where Proteus should deliberately surpass Rival instead of merely matching it

This file is intentionally stored inside the Proteus repo so the sibling teams can consume it without Proteus making direct changes to their worktrees.

## Comparison Snapshot

### Rival today

Rival currently presents as a complete platform, not just a chat client. The project includes:

- a richer route-driven frontend shell
- dedicated surfaces for notifications, bookmarks, favorites, profile, sessions, and account flows
- more mature message actions and message metadata
- richer read-state, search, and invite flows
- stronger voice/video/screen-share depth
- backend and platform layers for themes, bots, webhooks, moderation, discovery, and admin tooling

### Proteus today

Proteus already has strong foundations in areas that matter:

- Electron desktop shell
- BetterDiscord-compatible theming runtime
- responsive shell work
- guilds, channels, direct messages, attachments, typing, and roles
- LiveKit wiring for real-time media growth
- gamelets and app extensibility potential

Proteus is still behind Rival in several structural areas:

- navigation has historically been single-screen and local-state heavy
- richer product routes are limited or missing
- message metadata is still too shallow
- account/security/session flows are not at Rival depth
- explicit capability flags and graceful degradation are still early
- search, read states, reactions, pins, and notifications are incomplete

### Strategic direction

Proteus should not become a visual or architectural clone of Rival. The target is:

- Rival-level breadth
- stronger desktop UX
- superior theming/customization
- cleaner extension surfaces for gamelets, apps, and plugins

## Proteus-Owned Frontend Work

### Phase 1: Shell and State Foundation

Proteus-owned deliverables:

- move the app shell to route-driven navigation for:
  - login
  - DM home
  - DM thread
  - guild overview
  - guild channel
  - notifications
  - favorites
  - settings views
- introduce domain-oriented client stores for:
  - session
  - guilds
  - channels
  - DMs
  - messages
  - presence
  - voice state
  - notification capability flags
  - theme capability flags
- establish a first-party Proteus UI kit for:
  - buttons
  - inputs
  - menus
  - popouts
  - drawers
  - tabs
  - sheets
  - badges
  - skeletons
  - toasts
- transition new feature surfaces toward feature-local styles and component isolation instead of depending on the legacy global stylesheet for everything

### Phase 2: Messaging and Navigation Parity

Proteus-owned deliverables:

- message reply UI
- reaction bar and reaction picker UI
- pinned messages surface
- unread divider and new-message bar
- message action menu
- richer member list and presence presentation
- dedicated favorites/bookmarks views
- dedicated notifications/inbox views
- quick switcher / command palette
- search surface shell and filters UI
- guild overview pages
- direct message home surfaces
- richer channel detail and profile surfaces

### Phase 3: Calls, Account, Settings, and Media

Proteus-owned deliverables:

- real call lobby and reconnect UX on top of LiveKit
- participant roster and participant controls UI
- device settings UI
- screen-share session UX
- account sessions management UI
- MFA/passkey/SSO/OAuth entry surfaces behind capability flags
- invite/deep-link client handling
- richer notification preference UI
- expanded settings areas for:
  - privacy
  - sessions
  - notifications
  - keybinds
  - themes
  - connected accounts
  - voice/video
  - apps/gamelets

### Phase 4: Surpass Rival

Proteus-owned differentiators:

- BetterDiscord theme import and adaptation as a first-class feature
- exportable/shareable Proteus theme packs
- theme-aware UI presets layered on top of color themes
- keyboard-first command palette and desktop routing polish
- superior multiwindow and screen-share UX
- deeper gamelet/app integration
- stronger offline/cache-first startup behavior

## Sibling-Team Contracts

The frontend can scaffold the surfaces below now, but real parity depends on sibling teams providing stable contracts.

### Backend/API Contracts

Required endpoint families:

- replies
- reactions
- pins
- edits and deletes with audit metadata
- read states and unread counts
- inbox and mention feeds
- bookmarks/favorites sync
- search across messages/channels/users
- invites and join flows
- emoji and sticker catalogs
- theme CRUD and theme sharing
- account sessions
- MFA / WebAuthn / OAuth / SSO
- notification preferences
- push subscription registration
- discovery/search metadata
- moderation and admin resources
- bot/app and webhook resources

Expected shape guidance:

- normalized entity payloads
- explicit pagination contracts
- optimistic-action-safe response bodies
- stable IDs for messages, channels, conversations, reactions, pins, notifications, and sessions
- capability flags in session/bootstrap payloads so Proteus can degrade gracefully

### Gateway / Realtime Contracts

Required event families:

- message created/updated/deleted
- reaction added/removed
- reply/thread metadata updates
- pin changes
- read-state updates
- unread count updates
- presence updates
- typing events
- invite acceptance or membership changes
- notification/inbox events
- voice participant state changes
- screen-share state changes
- moderation/admin events where relevant

Expected shape guidance:

- stable event names
- documented reconnection behavior
- replay or resync strategy after disconnect
- idempotent event application where possible
- explicit per-domain subscription model

### Search Contracts

Required capabilities:

- message search
- people/member search
- channel and guild search
- filterable query parameters
- sort and pagination metadata
- snippet/highlight payloads when available

### Auth and Identity Contracts

Required capabilities:

- MFA enrollment and challenge flows
- passkeys / WebAuthn
- SSO/OAuth initiation and callback contracts
- deep-link invite acceptance
- session list and revoke endpoints
- account switching support if multi-session is intended

### Voice / Media Contracts

Required capabilities:

- participant roster metadata
- mute/deafen state
- screen-share state
- reconnect status
- moderation controls
- device capability/config payloads where needed

### Docs / Platform Contracts

Required sibling-team deliverables:

- OpenAPI coverage for the REST surface
- realtime/gateway event reference
- capability-flag reference
- auth flow documentation
- search contract documentation
- theme sharing/import/export documentation
- bots/apps/plugin surface documentation

## Frontend Capability-Flag Policy

Proteus should not present fake parity. Every incomplete domain should be represented by explicit capability flags so the client can:

- show the route or panel shell when useful
- clearly indicate that data or actions are pending backend readiness
- hide or disable actions that would otherwise be broken
- avoid coupling the rollout of frontend and backend work too tightly

Recommended bootstrap/session flags include:

- replies
- reactions
- pins
- readStates
- messageSearch
- customEmoji
- stickers
- gifPicker
- sessions
- accountSwitching
- mfa
- passkeys
- oauth
- pushNotifications
- voiceDevices
- participantModeration
- bots
- webhooks
- discovery

## Acceptance Checklist

Frontend parity acceptance:

- route-driven shell covers DM home, DM thread, guild overview, guild channel, notifications, favorites, and settings
- quick switcher works across servers, channels, DMs, favorites, and settings
- favorites/bookmarks work locally first and can later bind to synced backend data
- message surfaces support replies, reactions, pins, and unread states when contracts arrive
- notification and inbox surfaces degrade gracefully before server support is complete
- account/security/session flows render behind capability flags instead of breaking
- voice/call UI can progressively deepen without another shell rewrite

Platform acceptance:

- REST and gateway contracts are documented and versionable
- capability flags are included in a stable bootstrap/session contract
- search contracts support filters and pagination
- auth/session contracts support MFA/WebAuthn/OAuth growth
- bots/apps/webhooks have clear compatibility docs

## Where Proteus Should Beat Rival

Proteus should aim to exceed Rival in the following areas:

- desktop ergonomics
- theme adaptability
- visual customization
- command palette and keyboard flow
- multiwindow and screen-share experience
- app/gamelet extensibility
- startup performance and offline survivability

If Rival is the parity benchmark, these are the lanes where Proteus can become the preferred client instead of the equivalent client.
