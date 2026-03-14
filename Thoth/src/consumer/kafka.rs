//! Kafka consumer that reads `chat.events`, assigns Snowflake IDs, and writes to ScyllaDB.
//!
//! Each consumed message is deserialized as a [`MessageCreatedEvent`], stamped with a
//! unique [`SnowflakeGenerator`] ID, and persisted via [`MessageRepository`].

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::Message;
use std::sync::Arc;
use tokio_stream::StreamExt;
use tracing::{error, info, warn};

use crate::db::repository::MessageRepository;
use crate::models::message::{MessageCreatedEvent, MessageRow};
use crate::models::snowflake::SnowflakeGenerator;

/// Kafka stream consumer for the `chat.events` topic.
pub struct ChatEventConsumer {
    consumer: StreamConsumer,
    repo: Arc<MessageRepository>,
    snowflake: Arc<SnowflakeGenerator>,
}

impl ChatEventConsumer {
    /// Create a new consumer, subscribe to `topic`, and return ready to run.
    pub fn new(
        brokers: &str,
        group_id: &str,
        topic: &str,
        repo: Arc<MessageRepository>,
        snowflake: Arc<SnowflakeGenerator>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("group.id", group_id)
            .set("enable.auto.commit", "false")
            .set("auto.offset.reset", "earliest")
            .set("session.timeout.ms", "10000")
            .create()?;

        consumer.subscribe(&[topic])?;
        info!("Kafka consumer subscribed to [{topic}]");

        Ok(Self {
            consumer,
            repo,
            snowflake,
        })
    }

    /// Run the consume loop.  Call from a tokio task — loops forever until cancelled.
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
                    info!("Shutdown signal received, stopping consumer.");
                    break;
                }
            }
        }
    }

    async fn handle_payload(&self, payload: &[u8]) {
        let event: MessageCreatedEvent = match serde_json::from_slice(payload) {
            Ok(e) => e,
            Err(e) => {
                warn!("Skipping unparseable event: {e}");
                return;
            }
        };

        if event.event_type != "message_created" {
            // Future event types (message_edited, message_deleted, etc.) handled here.
            return;
        }

        let row = MessageRow {
            snowflake_id: self.snowflake.next_id(),
            channel_id: event.channel_id,
            sender_id: event.sender_id,
            content: event.content,
            created_at: event.timestamp,
            hermes_message_id: event.message_id,
        };

        if let Err(e) = self.repo.insert_message(&row).await {
            error!("Failed to persist message {}: {e}", row.snowflake_id);
            // In production: push to a dead-letter topic or retry queue.
        }
    }
}
