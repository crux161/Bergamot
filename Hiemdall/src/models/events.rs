use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;

/// Canonical Kafka event consumed from the `bergamot.activity` topic.
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(tag = "event_type")]
pub enum ActivityEvent {
    #[serde(rename = "message_created")]
    MessageCreated {
        message: MessageEventPayload,
        #[serde(default)]
        recipient_user_ids: Vec<String>,
        occurred_at: Option<DateTime<Utc>>,
    },

    #[serde(rename = "message_edited")]
    MessageEdited {
        message: MessageEventPayload,
        #[serde(default)]
        recipient_user_ids: Vec<String>,
        occurred_at: Option<DateTime<Utc>>,
    },

    #[serde(rename = "message_deleted")]
    MessageDeleted {
        message: MessageEventPayload,
        #[serde(default)]
        recipient_user_ids: Vec<String>,
        occurred_at: Option<DateTime<Utc>>,
    },

    #[serde(rename = "read_state_updated")]
    ReadStateUpdated {
        user_id: String,
        target_kind: String,
        target_id: String,
        last_read_message_id: Option<String>,
        last_read_at: Option<DateTime<Utc>>,
        updated_at: Option<DateTime<Utc>>,
        occurred_at: Option<DateTime<Utc>>,
    },

    #[serde(rename = "notification_created")]
    NotificationCreated {
        user_id: String,
        notification_type: String,
        message_id: String,
        stream_kind: String,
        stream_id: String,
        occurred_at: Option<DateTime<Utc>>,
        reason: Option<String>,
    },

    #[serde(rename = "notification_read")]
    NotificationRead {
        user_id: String,
        notification_id: Option<String>,
        read_all: bool,
        occurred_at: Option<DateTime<Utc>>,
    },

    #[serde(rename = "saved_item_updated")]
    SavedItemUpdated {
        user_id: String,
        kind: String,
        target_id: String,
        action: String,
        occurred_at: Option<DateTime<Utc>>,
    },
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct MessageEventPayload {
    pub id: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub attachments: Vec<Value>,
    pub reply_to_id: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub edited_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub sender_id: String,
    pub sender_username: String,
    pub sender_display_name: Option<String>,
    pub stream_kind: String,
    pub stream_id: String,
    pub server_id: Option<String>,
    pub server_name: Option<String>,
    pub channel_name: Option<String>,
}
