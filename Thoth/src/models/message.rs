use chrono::{DateTime, Utc};
use serde::Deserialize;

/// Incoming Kafka event from Hermes (chat.events topic).
#[derive(Debug, Deserialize)]
pub struct MessageCreatedEvent {
    /// Discriminator field (e.g. `"message_created"`).
    pub event_type: String,
    /// Channel the message was sent in.
    pub channel_id: String,
    /// User who sent the message.
    pub sender_id: String,
    /// Ephemeral ID assigned by Hermes.
    pub message_id: String,
    /// Message body text.
    pub content: String,
    /// When the message was sent (UTC).
    pub timestamp: DateTime<Utc>,
}

/// Row to be persisted in ScyllaDB.
#[derive(Debug)]
pub struct MessageRow {
    /// Globally unique, time-sortable ID assigned by [`SnowflakeGenerator`](crate::models::snowflake::SnowflakeGenerator).
    pub snowflake_id: i64,
    /// Channel the message belongs to (partition key in ScyllaDB).
    pub channel_id: String,
    /// Author of the message.
    pub sender_id: String,
    /// Message body text.
    pub content: String,
    /// Original creation timestamp (UTC).
    pub created_at: DateTime<Utc>,
    /// The ephemeral ID Hermes assigned, kept for dedup/tracing.
    pub hermes_message_id: String,
}
