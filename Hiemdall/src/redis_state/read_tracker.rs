//! Per-user, per-stream read tracking backed by Redis.
//!
//! Bergamot uses UUIDs rather than Snowflake IDs, so Heimdall stores explicit
//! read cursors and exact unread counters instead of relying on ID deltas.

use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use tracing::{debug, error, info};

fn read_message_key(user_id: &str, stream_id: &str) -> String {
    format!("read_state:{user_id}:{stream_id}:message_id")
}

fn read_timestamp_key(user_id: &str, stream_id: &str) -> String {
    format!("read_state:{user_id}:{stream_id}:ts")
}

fn stream_message_key(stream_id: &str) -> String {
    format!("stream_latest:{stream_id}:message_id")
}

fn stream_timestamp_key(stream_id: &str) -> String {
    format!("stream_latest:{stream_id}:ts")
}

fn unread_count_key(user_id: &str, stream_id: &str) -> String {
    format!("unread_count:{user_id}:{stream_id}")
}

/// Manages per-user read cursors and unread counts in Redis.
pub struct ReadTracker {
    conn: redis::aio::MultiplexedConnection,
}

impl ReadTracker {
    /// Connect to Redis and return a ready tracker.
    pub async fn new(redis_url: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = redis::Client::open(redis_url)?;
        let conn = client.get_multiplexed_async_connection().await?;
        info!("ReadTracker connected to Redis");
        Ok(Self { conn })
    }

    /// Persist the latest read cursor and clear unread count for the stream.
    pub async fn set_last_read(
        &self,
        user_id: &str,
        stream_id: &str,
        message_id: Option<&str>,
        read_at: Option<DateTime<Utc>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let message_key = read_message_key(user_id, stream_id);
        let timestamp_key = read_timestamp_key(user_id, stream_id);
        let unread_key = unread_count_key(user_id, stream_id);
        let mut conn = self.conn.clone();

        let mut pipe = redis::pipe();
        pipe.atomic();
        match message_id {
            Some(message_id) => {
                pipe.set(&message_key, message_id).ignore();
            }
            None => {
                pipe.del(&message_key).ignore();
            }
        }
        match read_at {
            Some(read_at) => {
                pipe.set(&timestamp_key, read_at.to_rfc3339()).ignore();
            }
            None => {
                pipe.del(&timestamp_key).ignore();
            }
        }
        pipe.set(&unread_key, 0_u64).ignore();

        let _: () = pipe.query_async(&mut conn).await.map_err(|e| {
            error!("Redis set_last_read failed for user={user_id} stream={stream_id}: {e}");
            e
        })?;

        debug!(
            user_id,
            stream_id,
            message_id = message_id.unwrap_or(""),
            "Updated read cursor and cleared unread count"
        );
        Ok(())
    }

    /// Record a new message and increment exact unread counts for recipients.
    pub async fn record_message_created(
        &self,
        stream_id: &str,
        message_id: &str,
        created_at: Option<DateTime<Utc>>,
        recipient_user_ids: &[String],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let latest_message_key = stream_message_key(stream_id);
        let latest_timestamp_key = stream_timestamp_key(stream_id);
        let mut conn = self.conn.clone();

        let mut pipe = redis::pipe();
        pipe.atomic();
        pipe.set(&latest_message_key, message_id).ignore();
        if let Some(created_at) = created_at {
            pipe.set(&latest_timestamp_key, created_at.to_rfc3339()).ignore();
        }
        for user_id in recipient_user_ids {
            pipe.incr(unread_count_key(user_id, stream_id), 1_i64).ignore();
        }

        let _: () = pipe.query_async(&mut conn).await.map_err(|e| {
            error!(
                "Redis record_message_created failed for stream={stream_id} message={message_id}: {e}"
            );
            e
        })?;

        debug!(
            stream_id,
            message_id,
            recipients = recipient_user_ids.len(),
            "Recorded message create and incremented unread counters"
        );
        Ok(())
    }

    /// Record a delete tombstone. The exact unread counter remains unchanged
    /// until the next read-state sync because Janus is still the source of
    /// truth for badge summaries during the migration.
    pub async fn record_message_deleted(
        &self,
        stream_id: &str,
        message_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        debug!(stream_id, message_id, "Observed message delete tombstone");
        Ok(())
    }

    /// Get a user's stored read cursor for a stream.
    #[allow(dead_code)]
    pub async fn get_last_read(
        &self,
        user_id: &str,
        stream_id: &str,
    ) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let key = read_message_key(user_id, stream_id);
        let mut conn = self.conn.clone();
        let val: Option<String> = conn.get(&key).await?;
        Ok(val)
    }

    /// Get the latest observed message ID for a stream.
    #[allow(dead_code)]
    pub async fn get_stream_latest(
        &self,
        stream_id: &str,
    ) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let key = stream_message_key(stream_id);
        let mut conn = self.conn.clone();
        let val: Option<String> = conn.get(&key).await?;
        Ok(val)
    }

    /// Get the stored unread count for a user/stream pair.
    #[allow(dead_code)]
    pub async fn get_unread_count(
        &self,
        user_id: &str,
        stream_id: &str,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let key = unread_count_key(user_id, stream_id);
        let mut conn = self.conn.clone();
        let val: Option<u64> = conn.get(&key).await?;
        Ok(val.unwrap_or(0))
    }
}
