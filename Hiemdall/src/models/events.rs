use serde::Deserialize;

/// Incoming Kafka event from the user.activity topic.
#[derive(Debug, Deserialize)]
#[serde(tag = "event_type")]
pub enum UserActivityEvent {
    /// Fired when a user views / scrolls to a message in a channel.
    #[serde(rename = "message_read")]
    MessageRead {
        user_id: String,
        channel_id: String,
        /// The Snowflake ID of the last message the user has seen.
        last_read_message_id: i64,
    },

    /// Fired when a user is explicitly mentioned (@user).
    #[serde(rename = "user_mentioned")]
    UserMentioned {
        user_id: String,
        channel_id: String,
        message_id: i64,
        sender_id: String,
    },
}
