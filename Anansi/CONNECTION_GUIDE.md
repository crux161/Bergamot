# Anansi — Connection Guide

## Ports

| Port | Listener | Who connects here |
|------|----------|-------------------|
| 9092 | INTERNAL | Other Docker containers (use `kafka:9092` as hostname) |
| 9093 | EXTERNAL | Host-machine services during local dev (use `localhost:9093`) |
| 9094 | CONTROLLER | KRaft consensus only — not for application use |
| 8080 | Kafka UI | Browser dashboard at `http://localhost:8080` |

## Service Connection Strings

### Python (Janus) — using aiokafka or confluent-kafka-python
```python
bootstrap_servers = "localhost:9093"
```

### Elixir (Hermes) — using brod
```elixir
kafka_brokers: [{"localhost", 9093}]
```

### Rust (Thoth / Heimdall) — using rdkafka
```rust
.set("bootstrap.servers", "localhost:9093")
```

### Docker-to-Docker (any service in docker-compose)
```
kafka:9092
```

## Topics

| Topic | Partitions | Producers | Consumers | Key |
|-------|-----------|-----------|-----------|-----|
| `user.events` | 6 | Janus | Hermes, Heimdall | user_id |
| `chat.messages` | 12 | Hermes | Thoth | channel_id |
| `chat.activity` | 6 | Hermes, Proteus | Heimdall | user_id |
| `bergamot.activity` | 6 | Janus | Heimdall, Mnemosyne | stream_id / user_id |
| `voice.signaling` | 6 | Apollo | Hermes | room_id |

## Quick Start

```bash
cd Anansi
docker compose up -d
# Wait ~30s for Kafka to initialize and topics to be created
# Then check: http://localhost:8080
```
