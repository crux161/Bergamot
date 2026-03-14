# Heimdall — Read State & Notification Worker

> Named for the Norse god who stands watch on the Bifrost bridge.
> Heimdall sees all — tracking what each user has and hasn't read.

**Language**: Rust | **State Store**: Redis 7 | **Ingestion**: Kafka consumer

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Consumer | `src/consumer/kafka.rs` | `rdkafka` StreamConsumer on `user.activity` |
| Read Tracker | `src/redis_state/read_tracker.rs` | Atomic read-cursor advancement via Lua scripts |
| Unread Calculator | `src/redis_state/unread.rs` | `has_unreads()` and `approximate_unread_count()` using Snowflake ID delta heuristic |
| Events | `src/models/events.rs` | Tagged enum: `MessageRead`, `UserMentioned` |

## Redis Key Schema

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `read_state:{user_id}:{channel_id}` | String | Snowflake ID of the last message read |
| `channel_latest:{channel_id}` | String | Snowflake ID of the newest message in channel |

## Unread Heuristic

Rather than counting messages between cursors (expensive), Heimdall uses a Snowflake ID delta heuristic:
- `has_unreads`: `channel_latest > read_state` (O(1))
- `approximate_count`: estimates from the sequence bits in the Snowflake delta

## Running

```bash
# Standalone
cd Hiemdall
docker compose up --build

# Against shared infrastructure
cd Hiemdall
cargo run
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `KAFKA_BROKERS` | `kafka:9092` | Kafka bootstrap servers |
| `KAFKA_GROUP_ID` | `heimdall-readers` | Consumer group ID |
| `KAFKA_TOPIC` | `user.activity` | Topic to consume |
| `RUST_LOG` | `info` | Log level filter |
