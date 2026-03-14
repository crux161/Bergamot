# Hermes — Real-Time Gateway

> Named for the Greek messenger god, herald of the Olympians.
> Hermes carries every message between connected clients in real-time.

**Language**: Elixir 1.16 | **Framework**: Phoenix 1.7 | **Transport**: Phoenix Channels (WebSocket)

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Socket | `lib/hermes/socket/user_socket.ex` | Authenticates WebSocket connections via JWT |
| JWT | `lib/hermes/socket/jwt.ex` | HS256 verification using JOSE (shared secret with Janus) |
| Channel | `lib/hermes/channels/chat_channel.ex` | `"channel:<id>"` rooms — broadcasts, typing, Kafka publish |
| Kafka | `lib/hermes/kafka/producer.ex` | `brod` producer to `chat.events`, partitioned by channel_id |
| Endpoint | `lib/hermes/endpoint.ex` | Phoenix.Endpoint with socket mount at `/socket` |

## Client Connection Flow

1. Client obtains a JWT from Janus (`POST /api/v1/auth/login`)
2. Client opens WebSocket to `ws://localhost:4000/socket/websocket?token=<jwt>`
3. Client joins `"channel:<channel_id>"` topic
4. Client pushes `"new_message"` events — Hermes broadcasts to peers and publishes to Kafka

## Channel Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `new_message` | client → server → all | Broadcast message, publish to Kafka |
| `typing` | client → server → others | Typing indicator (excluded from sender) |

## Running

```bash
# Standalone (with its own Kafka)
cd Hermes
mix deps.get
docker compose up --build

# Against shared infrastructure
cd Hermes
mix phx.server
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP/WS listen port |
| `JWT_SECRET` | — | JWT signing secret (must match Janus) |
| `SECRET_KEY_BASE` | — | Phoenix session secret (64+ bytes) |
| `KAFKA_HOST` | `kafka` | Kafka broker hostname |
| `KAFKA_PORT` | `9092` | Kafka broker port |
