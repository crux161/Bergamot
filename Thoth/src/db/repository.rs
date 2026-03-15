/// ScyllaDB data-access layer for persisting chat messages.
///
/// Wraps a shared `Session` with prepared statements for high-throughput inserts.

use scylla::statement::prepared::PreparedStatement;
use scylla::client::session::Session;
use std::sync::Arc;
use tracing::{error, info};

use crate::models::message::MessageRow;

/// Data-access layer for the `thoth.messages` table.
pub struct MessageRepository {
    session: Arc<Session>,
    insert_stmt: PreparedStatement,
}

impl MessageRepository {
    /// Create a new repository, preparing the insert statement against ScyllaDB.
    pub async fn new(session: Arc<Session>) -> Result<Self, Box<dyn std::error::Error>> {
        let insert_stmt = session
            .prepare(
                "INSERT INTO thoth.messages \
                 (channel_id, snowflake_id, sender_id, content, hermes_msg_id, created_at) \
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .await?;

        info!("MessageRepository prepared statements ready.");
        Ok(Self {
            session,
            insert_stmt,
        })
    }

    /// Persist a single message row.  Uses a prepared statement for throughput.
    pub async fn insert_message(&self, msg: &MessageRow) -> Result<(), Box<dyn std::error::Error>> {
        let created_at_ms = msg.created_at.timestamp_millis();

        self.session
            .execute_unpaged(
                &self.insert_stmt,
                (
                    &msg.channel_id,
                    msg.snowflake_id,
                    &msg.sender_id,
                    &msg.content,
                    &msg.hermes_message_id,
                    created_at_ms,
                ),
            )
            .await
            .map_err(|e| {
                error!("Failed to insert message {}: {e}", msg.snowflake_id);
                e
            })?;

        Ok(())
    }
}
