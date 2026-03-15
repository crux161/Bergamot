use std::time::{SystemTime, UNIX_EPOCH};
/// Snowflake ID generator for globally unique, time-sortable message identifiers.
///
/// Uses a lock-free `AtomicU64` CAS loop for monotonic generation within a single worker.

use std::sync::atomic::{AtomicU64, Ordering};

/// Custom epoch: 2024-01-01T00:00:00Z (ms)
const CUSTOM_EPOCH_MS: u64 = 1_704_067_200_000;

/// Generates unique 64-bit Snowflake IDs with embedded timestamp, worker, and sequence.
///
/// Layout (64 bits):
///   `[1 bit unused] [41 bits timestamp] [10 bits worker_id] [12 bits sequence]`
///
/// Gives ~69 years from custom epoch and 4 096 IDs per millisecond per worker.
pub struct SnowflakeGenerator {
    /// 10-bit worker identifier, stored widened to `u64` for shift arithmetic.
    worker_id: u64,
    /// Packed `(last_timestamp_ms << 12) | sequence` for atomic CAS.
    state: AtomicU64,
}

impl SnowflakeGenerator {
    /// Create a new generator for the given worker.
    ///
    /// # Panics
    /// Panics if `worker_id >= 1024` (must fit in 10 bits).
    pub fn new(worker_id: u16) -> Self {
        assert!(worker_id < 1024, "worker_id must fit in 10 bits");
        Self {
            worker_id: worker_id as u64,
            state: AtomicU64::new(0),
        }
    }

    /// Generate the next monotonically increasing Snowflake ID.
    ///
    /// Thread-safe via CAS. Spins if the per-millisecond sequence is exhausted.
    pub fn next_id(&self) -> i64 {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock went backwards")
            .as_millis() as u64;
        let ts = now_ms.saturating_sub(CUSTOM_EPOCH_MS);

        loop {
            let prev = self.state.load(Ordering::Relaxed);
            let prev_ts = prev >> 12;
            let prev_seq = prev & 0xFFF;

            let (new_ts, new_seq) = if ts == prev_ts {
                if prev_seq >= 0xFFF {
                    // Sequence exhausted for this ms — spin until next ms
                    std::hint::spin_loop();
                    continue;
                }
                (ts, prev_seq + 1)
            } else {
                (ts, 0)
            };

            let new_state = (new_ts << 12) | new_seq;
            if self
                .state
                .compare_exchange_weak(prev, new_state, Ordering::AcqRel, Ordering::Relaxed)
                .is_ok()
            {
                let id = (new_ts << 22) | (self.worker_id << 12) | new_seq;
                return id as i64;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn ids_are_unique_and_monotonic() {
        let gen = SnowflakeGenerator::new(1);
        let mut ids = Vec::with_capacity(10_000);
        for _ in 0..10_000 {
            ids.push(gen.next_id());
        }
        // Monotonic
        for w in ids.windows(2) {
            assert!(w[0] < w[1], "IDs must be strictly increasing");
        }
        // Unique
        let set: HashSet<i64> = ids.iter().copied().collect();
        assert_eq!(set.len(), ids.len());
    }
}
