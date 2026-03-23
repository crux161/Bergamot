//! Kafka consumer for the canonical `bergamot.activity` topic.
//!
//! Dispatches Janus-originated message and read-state events into Redis so
//! unread state can be rebuilt from a single durable event stream.

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::Message;
use std::sync::Arc;
use tokio_stream::StreamExt;
use tracing::{debug, error, info, warn};

use crate::models::events::{ActivityEvent, MessageEventPayload};
use crate::redis_state::read_tracker::ReadTracker;

/// Kafka stream consumer for the `bergamot.activity` topic.
pub struct ActivityConsumer {
    consumer: StreamConsumer,
    tracker: Arc<ReadTracker>,
}

impl ActivityConsumer {
    /// Create a new consumer, subscribe to `topic`, and return ready to run.
    pub fn new(
        brokers: &str,
        group_id: &str,
        topic: &str,
        tracker: Arc<ReadTracker>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("group.id", group_id)
            .set("enable.auto.commit", "false")
            .set("auto.offset.reset", "earliest")
            .set("session.timeout.ms", "10000")
            .create()?;

        consumer.subscribe(&[topic])?;
        info!("Heimdall consumer subscribed to [{topic}]");

        Ok(Self { consumer, tracker })
    }

    /// Run the consume loop. Loops until shutdown signal.
    pub async fn run(&self, mut shutdown: tokio::sync::watch::Receiver<bool>) {
        let mut stream = self.consumer.stream();

        loop {
            tokio::select! {
                maybe_msg = stream.next() => {
                    let Some(result) = maybe_msg else {
                        warn!("Kafka stream ended unexpectedly");
                        break;
                    };

                    match result {
                        Ok(borrowed_msg) => {
                            if let Some(payload) = borrowed_msg.payload() {
                                self.handle_payload(payload).await;
                            }
                            if let Err(e) = self.consumer.commit_message(&borrowed_msg, CommitMode::Async) {
                                error!("Commit failed: {e}");
                            }
                        }
                        Err(e) => {
                            error!("Kafka recv error: {e}");
                        }
                    }
                }
                _ = shutdown.changed() => {
                    info!("Shutdown signal received, stopping Heimdall consumer.");
                    break;
                }
            }
        }
    }

    async fn handle_payload(&self, payload: &[u8]) {
        let event: ActivityEvent = match serde_json::from_slice(payload) {
            Ok(event) => event,
            Err(e) => {
                warn!("Skipping unparseable activity event: {e}");
                return;
            }
        };

        match event {
            ActivityEvent::MessageCreated {
                message,
                recipient_user_ids,
                occurred_at,
            } => {
                if let Err(e) = self
                    .tracker
                    .record_message_created(
                        &message.stream_id,
                        &message.id,
                        message.created_at.or(occurred_at),
                        &recipient_user_ids,
                    )
                    .await
                {
                    error!(
                        "Failed to record message_created for stream={} message={}: {e}",
                        message.stream_id, message.id
                    );
                }
            }
            ActivityEvent::MessageEdited {
                message,
                recipient_user_ids: _,
                occurred_at: _,
            } => {
                self.log_message_event("message_edited", &message);
            }
            ActivityEvent::MessageDeleted {
                message,
                recipient_user_ids: _,
                occurred_at: _,
            } => {
                if let Err(e) = self
                    .tracker
                    .record_message_deleted(&message.stream_id, &message.id)
                    .await
                {
                    error!(
                        "Failed to record message_deleted for stream={} message={}: {e}",
                        message.stream_id, message.id
                    );
                }
            }
            ActivityEvent::ReadStateUpdated {
                user_id,
                target_kind,
                target_id,
                last_read_message_id,
                last_read_at,
                updated_at,
                occurred_at: _,
            } => {
                if let Err(e) = self
                    .tracker
                    .set_last_read(
                        &user_id,
                        &target_id,
                        last_read_message_id.as_deref(),
                        last_read_at.or(updated_at),
                    )
                    .await
                {
                    error!(
                        "Failed to update read state for user={user_id} target_kind={target_kind} target_id={target_id}: {e}"
                    );
                }
            }
            ActivityEvent::NotificationCreated {
                user_id,
                notification_type,
                message_id,
                stream_kind,
                stream_id,
                occurred_at,
                reason,
            } => {
                debug!(
                    user_id,
                    notification_type,
                    message_id,
                    stream_kind,
                    stream_id,
                    ?occurred_at,
                    ?reason,
                    "Notification event observed"
                );
            }
            ActivityEvent::NotificationRead {
                user_id,
                notification_id,
                read_all,
                occurred_at,
            } => {
                debug!(
                    user_id,
                    ?notification_id,
                    read_all,
                    ?occurred_at,
                    "Notification read event observed"
                );
            }
            ActivityEvent::SavedItemUpdated {
                user_id,
                kind,
                target_id,
                action,
                occurred_at,
            } => {
                debug!(
                    user_id,
                    kind,
                    target_id,
                    action,
                    ?occurred_at,
                    "Saved item event observed"
                );
            }
        }
    }

    fn log_message_event(&self, event_type: &str, message: &MessageEventPayload) {
        debug!(
            event_type,
            message_id = message.id,
            stream_kind = message.stream_kind,
            stream_id = message.stream_id,
            sender_id = message.sender_id,
            "Message lifecycle event observed"
        );
    }
}
