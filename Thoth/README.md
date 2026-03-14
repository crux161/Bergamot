# Thoth — Message Storage Service

> Named for the Egyptian god of writing, wisdom, and record-keeping.
> Thoth inscribes every message into the permanent record.

**Language**: Rust | **Storage**: ScyllaDB (Cassandra-compatible) | **Ingestion**: Kafka consumer

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Consumer | `src/consumer/kafka.rs` | `rdkafka` StreamConsumer on `chat.events`, manual commit |
| Repository | `src/db/repository.rs` | Prepared CQL INSERT into `messages` table |
| Schema | `src/db/schema.rs` | Keyspace + table migrations (partition by channel_id, cluster by snowflake_id DESC) |
| Snowflake | `src/models/snowflake.rs` | Lock-free 64-bit ID generator (41-bit timestamp + 10-bit worker + 12-bit sequence) |
| Models | `src/models/message.rs` | `MessageCreatedEvent` (Kafka) → `MessageRow` (ScyllaDB) |

## Snowflake ID Format

```
┌─ 1 bit ─┬──── 41 bits ────┬── 10 bits ──┬── 12 bits ──┐
│  unused  │  ms since epoch │  worker ID  │  sequence   │
└──────────┴─────────────────┴─────────────┴─────────────┘
Custom epoch: 2024-01-01T00:00:00Z
```

- Monotonic within a worker (AtomicU64 CAS loop)
- Sortable by time (newest messages have highest IDs)
- Supports 1024 workers, 4096 IDs per millisecond per worker

## Data Flow

```
Hermes → Kafka [chat.events] → Thoth → ScyllaDB [bergamot.messages]
```

## Running

```bash
# Standalone
cd Thoth
docker compose up --build

# Against shared infrastructure
cd Thoth
cargo run
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCYLLA_NODES` | `scylla:9042` | ScyllaDB contact points |
| `KAFKA_BROKERS` | `kafka:9092` | Kafka bootstrap servers |
| `KAFKA_GROUP_ID` | `thoth-writers` | Consumer group ID |
| `KAFKA_TOPIC` | `chat.events` | Topic to consume |
| `WORKER_ID` | `0` | Snowflake worker ID (0–1023) |
| `RUST_LOG` | `info` | Log level filter |
