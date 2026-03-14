#!/usr/bin/env bash
# Quick health check for Anansi — verifies Kafka is up and all topics exist.

set -euo pipefail

BOOTSTRAP="localhost:9093"
EXPECTED_TOPICS=("user.events" "chat.messages" "chat.activity" "voice.signaling")

echo "Checking Kafka broker at ${BOOTSTRAP}…"

if ! kafka-broker-api-versions --bootstrap-server "${BOOTSTRAP}" &>/dev/null; then
  echo "ERROR: Cannot reach Kafka at ${BOOTSTRAP}"
  echo "Is 'docker compose up' running in Anansi/?"
  exit 1
fi

echo "Broker is up. Checking topics…"

EXISTING=$(kafka-topics --list --bootstrap-server "${BOOTSTRAP}" 2>/dev/null)
MISSING=0

for topic in "${EXPECTED_TOPICS[@]}"; do
  if echo "${EXISTING}" | grep -q "^${topic}$"; then
    echo "  ✓ ${topic}"
  else
    echo "  ✗ ${topic} — MISSING"
    MISSING=1
  fi
done

if [ "${MISSING}" -eq 0 ]; then
  echo ""
  echo "All topics present. Anansi's web is intact."
else
  echo ""
  echo "Some topics are missing. Run: docker compose up init-topics"
  exit 1
fi
