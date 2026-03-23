//! Unread-message detection using exact counters stored in Redis.

use super::read_tracker::ReadTracker;

/// Calculates unread state from the exact counters maintained by Heimdall.
#[allow(dead_code)]
pub struct UnreadCalculator<'a> {
    tracker: &'a ReadTracker,
}

#[allow(dead_code)]
impl<'a> UnreadCalculator<'a> {
    /// Wrap an existing [`ReadTracker`] to compute unread state.
    pub fn new(tracker: &'a ReadTracker) -> Self {
        Self { tracker }
    }

    /// Returns `true` if the user has any unread messages in the stream.
    pub async fn has_unreads(
        &self,
        user_id: &str,
        stream_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        Ok(self.tracker.get_unread_count(user_id, stream_id).await? > 0)
    }

    /// Returns the exact unread count stored by Heimdall for the stream.
    pub async fn approximate_unread_count(
        &self,
        user_id: &str,
        stream_id: &str,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        self.tracker.get_unread_count(user_id, stream_id).await
    }
}
