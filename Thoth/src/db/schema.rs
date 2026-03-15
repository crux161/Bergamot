//! ScyllaDB schema definitions and migration runner for the Thoth keyspace.
//!
//! Creates the `thoth` keyspace, `messages` table, and secondary indexes on first run.

use scylla::client::session::Session;
use tracing::info;

/// CQL statements to initialize the Thoth keyspace and tables.
const CREATE_KEYSPACE: &str = r#"
    CREATE KEYSPACE IF NOT EXISTS thoth
    WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
    }
"#;

/// Messages table: partitioned by channel_id, clustered by snowflake_id DESC
/// so the most recent messages in a channel are on the same partition and
/// naturally sorted for pagination.
const CREATE_MESSAGES_TABLE: &str = r#"
    CREATE TABLE IF NOT EXISTS thoth.messages (
        channel_id    text,
        snowflake_id  bigint,
        sender_id     text,
        content       text,
        hermes_msg_id text,
        created_at    timestamp,
        PRIMARY KEY (channel_id, snowflake_id)
    ) WITH CLUSTERING ORDER BY (snowflake_id DESC)
"#;

/// Secondary index for fetching a user's recent messages across channels.
const CREATE_SENDER_INDEX: &str = r#"
    CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON thoth.messages (sender_id)
"#;

/// Execute idempotent DDL statements to ensure the keyspace, table, and indexes exist.
pub async fn run_migrations(session: &Session) -> Result<(), Box<dyn std::error::Error>> {
    info!("Running Thoth schema migrations…");

    session.query_unpaged(CREATE_KEYSPACE, &[]).await?;
    session.query_unpaged(CREATE_MESSAGES_TABLE, &[]).await?;
    session.query_unpaged(CREATE_SENDER_INDEX, &[]).await?;

    info!("Schema migrations complete.");
    Ok(())
}
