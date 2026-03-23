# Bergamot

Bergamot is a polyglot communications platform built as a multi-service ecosystem. The repository now contains the core product stack, the realtime layer, search and unread projections, voice infrastructure, an edge/router layer, a moderation/admin surface, and shared packages used across the frontend-facing services.

This README describes the codebase as it exists today. For deeper roadmap and parity-tracking documents, see `MOVING_FORWARD.md` and `MOVING_FORWARD_II.md`.

## What Exists Today

- Community servers, channels, direct messages, replies, reactions, pins, read states, inbox, mentions, saved items, and message search.
- Auth flows for registration, login, email verification, password reset, session management, TOTP MFA, and passkeys.
- Account switching, linked-account scaffolding, OAuth surfaces, blocking, reporting, moderation, and an admin console.
- LiveKit-backed voice infrastructure, a media edge service, a search indexer, and a shared capability/config/contracts layer.
- A shared Proteus frontend that supports Electron desktop and web builds from the same renderer codebase.

## Capability Snapshot

The shared instance manifest currently advertises these product capabilities as enabled:

- route shell, favorites, quick switcher, custom themes, local notifications
- replies, reactions, pins, inbox, mentions, saved items, message search, read states
- sessions, account switching, MFA, passkeys, OAuth

These are still not enabled in the shared manifest:

- custom emoji, stickers, GIF picker
- push notifications
- voice device controls and participant moderation
- bots, webhooks, discovery

The source of truth for this snapshot lives in `packages/contracts/data/instance-manifest.json`.

## Architecture

![Diagram of Bergamot Project as it functions in March 2026](/diagram-2026-03.png)

## Service Map

| Service | Stack | Role | Default Ports |
| --- | --- | --- | --- |
| `Proteus` | TypeScript, React, Electron, Vite/Webpack | Shared client for desktop and web | `3000` desktop dev renderer, `3001` web dev |
| `Janus` | Python, FastAPI, SQLAlchemy, Postgres | Canonical API for auth, identity, messaging, notifications, search APIs, moderation | `8000` |
| `Hermes` | Elixir, Phoenix | Realtime gateway, channel sockets, user-scoped realtime events | `4000` |
| `Thoth` | Rust | Kafka consumer / message persistence worker | internal |
| `Hiemdall` | Rust, Redis | Read-state and unread-materialization worker | internal |
| `Mnemosyne` | Node.js, KafkaJS, Meilisearch | Search projection worker for message indexing | `9102` |
| `Apollo` | LiveKit runtime | Voice/video plane | `7880`, `7881`, `50000-50200/udp` |
| `MediaProxy` | Node.js | Media edge / attachment proxy surface | `9100` |
| `Admin` | Node.js static server + frontend | Moderation and admin UI surface | `9101` |
| `EdgeProxy` | Caddy | Unified edge router for web/API/socket/media/admin paths | `8088` |
| `Anansi` | Kafka (KRaft) + Kafka UI | Event backbone for Bergamot workers | `9092`, `9093`, `9094`, `8080` |
| shared `packages/*` | TypeScript | Contracts, runtime config, UI tokens | n/a |

## Major Backend Surfaces

`Janus` currently exposes routes for:

- auth, instance discovery, sessions, MFA, passkeys
- friends/blocking, connections, OAuth2, invites, gifts
- servers, channels, DMs, messages, reactions, roles
- read states, mentions, notifications, saved items, search, uploads
- reports, bans, admin, audit log, notes

`Hermes` is the realtime gateway and now supports both room-style messaging topics and user-scoped events used by inbox and unread updates.

`Thoth`, `Hiemdall`, and `Mnemosyne` are downstream consumers driven from canonical activity events. `Mnemosyne` feeds Meilisearch for message search.

## Edge Routing

The edge layer is defined in `EdgeProxy/Caddyfile` and currently routes:

- `/` to the Proteus web app
- `/api/*` to Janus
- `/socket*` to Hermes
- `/uploads/*` to Janus uploads
- `/media*` to MediaProxy
- `/admin*` to the Admin app

## Shared Packages

The root workspace includes:

- `packages/contracts`: shared capability flags, payload types, and manifest data
- `packages/config`: shared runtime config helpers
- `packages/ui-tokens`: shared design tokens used by frontend surfaces

These packages are consumed by the Proteus frontend and the newer Node-based edge/admin services.

## Running The Stack

### Full Docker Stack

This is the easiest way to run Bergamot as the repository is currently organized.

```bash
make docker-build
make docker-up
```

That boots:

- Anansi / Kafka
- Postgres, ScyllaDB, Redis, Atlas (MinIO), and Apollo (LiveKit)
- Meilisearch, Mnemosyne, MediaProxy, Admin, and EdgeProxy
- Janus, Hermes, Thoth, and Hiemdall

To stop everything:

```bash
make docker-down
```

### Infrastructure Only

If you want shared infrastructure but prefer to run app services locally:

```bash
make infra-up
```

This starts Kafka plus the shared data-plane services:

- Postgres
- ScyllaDB
- Redis
- Atlas / MinIO
- Apollo / LiveKit

To stop that layer:

```bash
make infra-down
```

### Local Service Development

Common inner-loop commands:

```bash
make janus
make hermes
make thoth
make hiemdall
make proteus
make admin
make media-proxy
make mnemosyne
```

For web-only Proteus development from the root workspace:

```bash
npm run dev:proteus:web
```

For a production-style web build:

```bash
npm run build:proteus:web
```

Notes:

- `make proteus` launches the Electron desktop flow and expects local ports/files for the renderer and main/preload bundles.
- The Docker stack is the reference runtime for Apollo/voice and the edge/admin/search/media helper services.

## Search And Replay

To republish canonical historical activity into Kafka so derived workers can rebuild:

```bash
make backfill-activity
```

This is primarily useful for replaying events into consumers like `Mnemosyne` and other derived workers.

## Repository Layout

```text
Bergamot/
├── Admin/                  # Admin frontend/server
├── Anansi/                 # Kafka + Kafka UI compose
├── Apollo/                 # Voice/video config and legacy transition code
├── EdgeProxy/              # Caddy edge router
├── Hermes/                 # Phoenix realtime gateway
├── Hiemdall/               # Redis-backed unread/read-state worker
├── Janus/                  # FastAPI API and canonical domain logic
├── MediaProxy/             # Media edge service
├── Mnemosyne/              # Kafka -> Meilisearch indexer
├── Proteus/                # Shared Electron + web client
├── Thoth/                  # Message persistence worker
├── packages/
│   ├── contracts/          # Shared feature manifest and contracts
│   ├── config/             # Shared runtime config helpers
│   └── ui-tokens/          # Shared UI tokens
├── docker-compose.yml      # Root infra/runtime compose
├── docker-compose.edge.yml # Edge, admin, media, search helpers
└── Makefile                # Primary orchestration entrypoint
```

## Documentation

Generate service documentation with:

```bash
make docs
```

Service-specific targets:

```bash
make docs-janus
make docs-hermes
make docs-thoth
make docs-hiemdall
make docs-apollo
```

## Notes On Current Scope

Bergamot has grown well beyond the original chat-only slice. The repository now includes:

- the product API
- realtime delivery
- unread/search projections
- voice infrastructure
- edge routing
- moderation/admin
- shared frontend contracts

Some parity work is still intentionally unfinished, and the shared capability manifest is the best quick source for what is on versus still scaffolded.
