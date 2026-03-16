/// Thoth — Message Routing & Storage Service.
///
/// Consumes `message_created` events from Kafka (`chat.events` topic),
/// assigns each message a Snowflake ID, and persists it to ScyllaDB.

mod consumer;
mod db;
mod models;

use std::sync::Arc;

use scylla::client::session_builder::SessionBuilder;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::consumer::kafka::ChatEventConsumer;
use crate::db::repository::MessageRepository;
use crate::db::schema::run_migrations;
use crate::models::snowflake::SnowflakeGenerator;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    info!("Thoth — Message Routing & Storage Service starting…");

    // --- Config from env ---
    let scylla_nodes =
        std::env::var("SCYLLA_NODES").unwrap_or_else(|_| "127.0.0.1:9042".to_string());
    let kafka_brokers =
        std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9093".to_string());
    let kafka_group = std::env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "thoth-writers".to_string());
    let kafka_topic = std::env::var("KAFKA_TOPIC").unwrap_or_else(|_| "chat.events".to_string());
    let worker_id: u16 = std::env::var("WORKER_ID")
        .unwrap_or_else(|_| "0".to_string())
        .parse()
        .expect("WORKER_ID must be u16 < 1024");

    // --- ScyllaDB ---
    let scylla_nodes: Vec<&str> = scylla_nodes.split(',').collect();
    let session = SessionBuilder::new()
        .known_nodes(&scylla_nodes)
        .build()
        .await?;
    let session = Arc::new(session);

    run_migrations(&session).await?;

    let repo = Arc::new(MessageRepository::new(session).await?);
    let snowflake = Arc::new(SnowflakeGenerator::new(worker_id));

    // --- Shutdown signal ---
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    // --- Kafka consumer ---
    let consumer = ChatEventConsumer::new(
        &kafka_brokers,
        &kafka_group,
        &kafka_topic,
        repo,
        snowflake,
    )?;

    let consumer_handle = tokio::spawn(async move {
        consumer.run(shutdown_rx).await;
    });

    // --- Wait for SIGTERM / Ctrl+C ---
    tokio::signal::ctrl_c().await?;
    info!("Shutdown requested…");
    let _ = shutdown_tx.send(true);
    consumer_handle.await?;
    info!("Thoth shut down cleanly.");

    Ok(())
}
