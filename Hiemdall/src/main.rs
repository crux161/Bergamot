/// Heimdall — Read State & Notification Worker.
///
/// Consumes `user.activity` events from Kafka, updates per-user read cursors
/// in Redis, and dispatches mention notifications.

mod consumer;
mod models;
mod redis_state;

use std::sync::Arc;

use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::consumer::kafka::ActivityConsumer;
use crate::redis_state::read_tracker::ReadTracker;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    info!("Heimdall — Read State & Notification Worker starting…");

    // --- Config from env ---
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let kafka_brokers =
        std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9093".to_string());
    let kafka_group =
        std::env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "heimdall-readers".to_string());
    let kafka_topic =
        std::env::var("KAFKA_TOPIC").unwrap_or_else(|_| "user.activity".to_string());

    // --- Redis ---
    let tracker = Arc::new(ReadTracker::new(&redis_url).await?);

    // --- Shutdown signal ---
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    // --- Kafka consumer ---
    let consumer = ActivityConsumer::new(&kafka_brokers, &kafka_group, &kafka_topic, tracker)?;

    let consumer_handle = tokio::spawn(async move {
        consumer.run(shutdown_rx).await;
    });

    // --- Wait for SIGTERM / Ctrl+C ---
    tokio::signal::ctrl_c().await?;
    info!("Shutdown requested…");
    let _ = shutdown_tx.send(true);
    consumer_handle.await?;
    info!("Heimdall shut down cleanly.");

    Ok(())
}
