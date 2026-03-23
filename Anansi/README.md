# Anansi — The Message Broker

> Named for the West African trickster god of stories and webs.
> Anansi spins the threads that connect every service in Bergamot.

**Runtime**: Apache Kafka (Confluent cp-kafka 7.7.1) | **Mode**: KRaft (no ZooKeeper)

## Architecture

Single-node KRaft broker with dual listeners:

| Listener | Port | Audience |
|----------|------|----------|
| INTERNAL | 9092 | Docker containers (`kafka:9092`) |
| EXTERNAL | 9093 | Host machine (`localhost:9093`) |
| CONTROLLER | 9094 | KRaft consensus (internal only) |

## Topics

| Topic | Partitions | Key | Producer | Consumer |
|-------|-----------|-----|----------|----------|
| `user.events` | 6 | user_id | Janus | Hermes, Heimdall |
| `chat.messages` | 12 | channel_id | Hermes | Thoth |
| `chat.activity` | 6 | user_id | Hermes | Heimdall |
| `bergamot.activity` | 6 | stream_id / user_id | Janus | Heimdall, Mnemosyne |
| `voice.signaling` | 6 | room_id | Apollo | Hermes |

## Running

```bash
cd Anansi
docker compose up -d

# Verify broker and topics
bash scripts/health-check.sh
```

## Dashboard

Kafka UI is available at `http://localhost:8080` — browse topics, inspect messages, monitor consumer group lag.

## Connection Strings

| Service | Language | Connection |
|---------|----------|------------|
| Janus | Python | `bootstrap_servers="localhost:9093"` |
| Hermes | Elixir | `[{"localhost", 9093}]` |
| Thoth | Rust | `bootstrap.servers = "localhost:9093"` |
| Heimdall | Rust | `bootstrap.servers = "localhost:9093"` |

When running inside Docker, use `kafka:9092` instead.
