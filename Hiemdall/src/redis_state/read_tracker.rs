//! Per-user, per-channel read-cursor management backed by Redis.
//!
//! Cursors are Snowflake IDs and are only advanced forward to tolerate
//! out-of-order or duplicate `message_read` events.

use redis::AsyncCommands;
use tracing::{error, info};

/// Manages per-user, per-channel read cursors in Redis.
///
/// Key schema:
///   `read_state:{user_id}:{channel_id}` → last_read_message_id (Snowflake, i64)
///   `channel_latest:{channel_id}`       → latest_message_id (Snowflake, i64)
///
/// The first key is written by Heimdall when a `message_read` event arrives.
/// The second key is written by Heimdall when it observes new messages flowing
/// through (or by Thoth via a separate publish — depends on deployment wiring).
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

    /// Update a user's read cursor for a channel.
    /// Only advances forward — ignores stale / out-of-order events.
    pub async fn set_last_read(
        &self,
        user_id: &str,
        channel_id: &str,
        message_id: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let key = format!("read_state:{user_id}:{channel_id}");
        let mut conn = self.conn.clone();

        // Atomic check-and-set: only write if new value > existing value.
        // Uses a Lua script for atomicity without WATCH/MULTI overhead.
        let script = redis::Script::new(
            r#"
            local current = tonumber(redis.call('GET', KEYS[1]) or 0)
            local proposed = tonumber(ARGV[1])
            if proposed > current then
                redis.call('SET', KEYS[1], ARGV[1])
                return 1
            end
            return 0
            "#,
        );

        let updated: i32 = script
            .key(&key)
            .arg(message_id)
            .invoke_async(&mut conn)
            .await
            .map_err(|e| {
                error!("Redis set_last_read failed for {key}: {e}");
                e
            })?;

        if updated == 1 {
            tracing::debug!("Advanced read cursor {key} -> {message_id}");
        }

        Ok(())
    }

    /// Record the latest message ID posted in a channel.
    /// Called when we observe a new message event (from chat.events or a side-channel).
    pub async fn set_channel_latest(
        &self,
        channel_id: &str,
        message_id: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let key = format!("channel_latest:{channel_id}");
        let mut conn = self.conn.clone();

        let script = redis::Script::new(
            r#"
            local current = tonumber(redis.call('GET', KEYS[1]) or 0)
            local proposed = tonumber(ARGV[1])
            if proposed > current then
                redis.call('SET', KEYS[1], ARGV[1])
                return 1
            end
            return 0
            "#,
        );

        let _: i32 = script
            .key(&key)
            .arg(message_id)
            .invoke_async(&mut conn)
            .await?;

        Ok(())
    }

    /// Get a user's last-read message ID for a channel.
    pub async fn get_last_read(
        &self,
        user_id: &str,
        channel_id: &str,
    ) -> Result<Option<i64>, Box<dyn std::error::Error>> {
        let key = format!("read_state:{user_id}:{channel_id}");
        let mut conn = self.conn.clone();
        let val: Option<i64> = conn.get(&key).await?;
        Ok(val)
    }

    /// Get the latest message ID for a channel.
    pub async fn get_channel_latest(
        &self,
        channel_id: &str,
    ) -> Result<Option<i64>, Box<dyn std::error::Error>> {
        let key = format!("channel_latest:{channel_id}");
        let mut conn = self.conn.clone();
        let val: Option<i64> = conn.get(&key).await?;
        Ok(val)
    }
}
