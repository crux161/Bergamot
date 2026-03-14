//! Unread-message detection using Snowflake ID comparisons in Redis.
//!
//! Provides both a boolean "has unreads" check and an approximate count
//! derived from the Snowflake timestamp delta. Exact counts require a
//! ScyllaDB query through Thoth.

use tracing::debug;

use super::read_tracker::ReadTracker;

/// Calculates unread message counts by comparing read cursors against
/// channel latest pointers.
///
/// Because both values are Snowflake IDs (monotonically increasing),
/// the *exact* unread count requires querying ScyllaDB:
///   SELECT COUNT(*) FROM thoth.messages
///     WHERE channel_id = ? AND snowflake_id > ?
///
/// However, for the common "has unreads" badge and approximate count,
/// we can use the delta between Snowflake IDs as a fast heuristic
/// (since IDs increment roughly per-message).  For an exact count,
/// call into Thoth's query API (future work).
pub struct UnreadCalculator<'a> {
    tracker: &'a ReadTracker,
}

impl<'a> UnreadCalculator<'a> {
    /// Wrap an existing [`ReadTracker`] to compute unread state.
    pub fn new(tracker: &'a ReadTracker) -> Self {
        Self { tracker }
    }

    /// Returns `true` if the user has any unread messages in the channel.
    pub async fn has_unreads(
        &self,
        user_id: &str,
        channel_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let last_read = self.tracker.get_last_read(user_id, channel_id).await?;
        let channel_latest = self.tracker.get_channel_latest(channel_id).await?;

        match (last_read, channel_latest) {
            (Some(read), Some(latest)) => Ok(latest > read),
            // User has never read this channel but messages exist
            (None, Some(_)) => Ok(true),
            // No messages in channel at all
            (_, None) => Ok(false),
        }
    }

    /// Approximate unread count using Snowflake ID delta.
    /// Returns 0 if fully caught up, or a positive estimate.
    /// For exact counts, query Thoth/ScyllaDB directly.
    pub async fn approximate_unread_count(
        &self,
        user_id: &str,
        channel_id: &str,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let last_read = self.tracker.get_last_read(user_id, channel_id).await?;
        let channel_latest = self.tracker.get_channel_latest(channel_id).await?;

        let count = match (last_read, channel_latest) {
            (Some(read), Some(latest)) if latest > read => {
                // Snowflake IDs: lower 12 bits are sequence, next 10 are worker.
                // Strip worker+sequence to get a rough message-count proxy.
                // This is intentionally approximate.
                let delta = (latest - read) >> 22; // timestamp-level delta
                // Clamp to at least 1 if there's any gap at all
                std::cmp::max(delta as u64, 1)
            }
            (None, Some(_)) => {
                // Never read — we don't know how many, signal "some"
                debug!("User {user_id} has never read channel {channel_id}");
                1
            }
            _ => 0,
        };

        Ok(count)
    }
}
