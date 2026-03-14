# Bergamot

A Discord-inspired chat platform built as a polyglot microservices architecture. Each service is named after a mythological figure and implements a specific domain boundary.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Proteus  │────▶│  Janus   │     │  Anansi  │
│ (Desktop) │     │ (API)    │     │ (Kafka)  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │  WebSocket     │  Kafka         │
     ▼                ▼                │
┌──────────┐     ┌──────────┐         │
│  Hermes  │◀───▶│  Thoth   │◀────────┘
│ (Realtime)│     │ (Store)  │
└──────────┘     └──────────┘
     │                │
     │  Kafka         │
     ▼                │
┌──────────┐     ┌──────────┐
│ Heimdall │     │  Apollo  │
│ (Unread) │     │ (Voice)  │
└──────────┘     └──────────┘
```

## Services

| Service | Language | Role | Port |
|---------|----------|------|------|
| **Janus** | Python / FastAPI | Core API, identity, auth (JWT) | 8000 |
| **Hermes** | Elixir / Phoenix | Real-time gateway (WebSocket channels) | 4000 |
| **Thoth** | Rust | Message persistence (Kafka → ScyllaDB) | — |
| **Heimdall** | Rust | Read-state tracking (Kafka → Redis) | — |
| **Apollo** | Node.js + Go | Voice/video SFU (mediasoup + gem) | 5000 |
| **Proteus** | TypeScript / Electron | Desktop client (React + Semi Design) | 3000 |
| **Anansi** | — | Kafka broker (KRaft mode, no ZooKeeper) | 9093 |

## Quick Start

```bash
# 1. Start shared infrastructure (Kafka, PostgreSQL, ScyllaDB, Redis)
make infra-up

# 2. Start individual services (each in its own terminal)
make janus
make hermes
make thoth
make hiemdall
make proteus

# 3. Tear down
make infra-down
```

## Data Flow

1. **Auth**: Client authenticates via Janus REST API, receives a JWT
2. **Realtime**: Client opens a Phoenix WebSocket to Hermes with the JWT
3. **Messaging**: Hermes broadcasts messages to channel peers and publishes to Kafka
4. **Persistence**: Thoth consumes from Kafka and writes to ScyllaDB with Snowflake IDs
5. **Read State**: Heimdall consumes activity events and maintains read cursors in Redis
6. **Voice**: Apollo manages SFU rooms — peers connect via WebRTC, RTP is fanned out 1-to-N

## Kafka Topics

| Topic | Partitions | Producer | Consumer |
|-------|-----------|----------|----------|
| `user.events` | 6 | Janus | Hermes, Heimdall |
| `chat.messages` | 12 | Hermes | Thoth |
| `chat.activity` | 6 | Hermes | Heimdall |
| `voice.signaling` | 6 | Apollo | Hermes |

## Documentation

```bash
# Generate docs for all services
make docs

# Service-specific docs
make docs-janus    # Sphinx (Python)
make docs-hermes   # ExDoc (Elixir)
make docs-thoth    # cargo doc (Rust)
make docs-hiemdall # cargo doc (Rust)
make docs-apollo   # godoc (Go)
```

## Project Structure

```
Bergamot/
├── Janus/          # Python — Core API & Identity
├── Hermes/         # Elixir — Real-Time Gateway
├── Thoth/          # Rust   — Message Storage
├── Hiemdall/       # Rust   — Read State Worker
├── Apollo/         # Node.js + Go — Voice/Video SFU
│   ├── src/        # mediasoup Node.js SFU
│   └── gem/        # Go WebRTC transport + SFU
├── Proteus/        # TypeScript — Electron Desktop Client
├── Anansi/         # Kafka broker configuration
├── docker-compose.yml   # Shared infrastructure
└── Makefile             # Orchestration commands
```
