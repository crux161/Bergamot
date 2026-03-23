# Heimdall

Derived unread-state worker for Bergamot.

- Consumes canonical Janus-originated events from Kafka topic `bergamot.activity`
- Stores per-user, per-stream read cursors in Redis
- Maintains exact unread counters for channel and DM streams
- Observes notification and saved-item events for future inbox/push fanout work

## Redis keys

- `read_state:{user_id}:{stream_id}:message_id`
- `read_state:{user_id}:{stream_id}:ts`
- `stream_latest:{stream_id}:message_id`
- `stream_latest:{stream_id}:ts`
- `unread_count:{user_id}:{stream_id}`

## Current behavior

- `message_created` updates the latest message pointer and increments unread counters for recipients
- `read_state_updated` stores the new cursor and resets unread count for that stream
- `message_deleted`, `notification_created`, `notification_read`, and `saved_item_updated` are consumed so the contract stays aligned, even where downstream handling is still lightweight

## Environment

- `REDIS_URL` defaults to `redis://redis:6379`
- `KAFKA_BROKERS` defaults to `kafka:9092`
- `KAFKA_GROUP_ID` defaults to `heimdall-readers`
- `KAFKA_TOPIC` defaults to `bergamot.activity`
- `RUST_LOG` defaults to `info`
