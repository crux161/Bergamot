//! Kafka consumer for the `user.activity` topic.
//!
//! Dispatches [`UserActivityEvent`] variants to update Redis read cursors
//! and log mention notifications.

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::Message;
use std::sync::Arc;
use tokio_stream::StreamExt;
use tracing::{error, info, warn};

use crate::models::events::UserActivityEvent;
use crate::redis_state::read_tracker::ReadTracker;

/// Kafka stream consumer for the `user.activity` topic.
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
        let event: UserActivityEvent = match serde_json::from_slice(payload) {
            Ok(e) => e,
            Err(e) => {
                warn!("Skipping unparseable activity event: {e}");
                return;
            }
        };

        match event {
            UserActivityEvent::MessageRead {
                user_id,
                channel_id,
                last_read_message_id,
            } => {
                if let Err(e) = self
                    .tracker
                    .set_last_read(&user_id, &channel_id, last_read_message_id)
                    .await
                {
                    error!(
                        "Failed to update read state for user={user_id} channel={channel_id}: {e}"
                    );
                }
            }

            UserActivityEvent::UserMentioned {
                user_id,
                channel_id,
                message_id,
                sender_id,
            } => {
                // In the future: push notification via APNs/FCM, or publish
                // to a notification.push Kafka topic for a dedicated push service.
                info!(
                    "MENTION: user={user_id} mentioned by={sender_id} in channel={channel_id} msg={message_id} — notification pending"
                );
            }
        }
    }
}
