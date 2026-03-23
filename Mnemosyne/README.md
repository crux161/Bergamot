# Mnemosyne

Search projection worker for Bergamot.

- Consumes canonical Janus activity events from Kafka topic `bergamot.activity`
- Indexes `message_created` and `message_edited` events into Meilisearch
- Writes `message_deleted` tombstones so downstream search can exclude deleted messages without losing event history
- Exposes `GET /health` with consumer and indexing stats
- Runs as part of [docker-compose.edge.yml](/Volumes/DevWorkspace/Bergamot/docker-compose.edge.yml) for local parity environments

## Environment

- `PORT` defaults to `9102`
- `KAFKA_BROKERS` defaults to `localhost:9093`
- `KAFKA_TOPIC` defaults to `bergamot.activity`
- `KAFKA_GROUP_ID` defaults to `mnemosyne-search`
- `MEILISEARCH_URL` defaults to `http://localhost:7700`
- `MEILISEARCH_INDEX` defaults to `messages`
- `MEILISEARCH_API_KEY` defaults to empty

## Backfill

Seed the projection from existing Janus data with:

```bash
cd Janus
python scripts/backfill_activity.py
```
