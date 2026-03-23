import http from "node:http";
import process from "node:process";

import { Kafka, logLevel } from "kafkajs";

const port = Number(process.env.PORT || 9102);
const config = {
  kafkaBrokers: (process.env.KAFKA_BROKERS || "localhost:9093")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  kafkaTopic: process.env.KAFKA_TOPIC || "bergamot.activity",
  kafkaGroupId: process.env.KAFKA_GROUP_ID || "mnemosyne-search",
  meilisearchUrl: process.env.MEILISEARCH_URL || "http://localhost:7700",
  meilisearchIndex: process.env.MEILISEARCH_INDEX || "messages",
  meilisearchApiKey: process.env.MEILISEARCH_API_KEY || "",
};

const state = {
  service: "mnemosyne",
  projection: "search-index",
  consumerConnected: false,
  meilisearchReady: false,
  indexedDocuments: 0,
  tombstonedDocuments: 0,
  failedEvents: 0,
  lastEventType: null,
  lastMessageId: null,
  lastProcessedAt: null,
  lastError: null,
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function meiliHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.meilisearchApiKey) {
    headers.Authorization = `Bearer ${config.meilisearchApiKey}`;
  }
  return headers;
}

async function meiliRequest(path, options = {}) {
  const response = await fetch(`${config.meilisearchUrl}${path}`, {
    ...options,
    headers: {
      ...meiliHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.ok) {
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  const body = await response.text();
  throw new Error(`Meilisearch request failed (${response.status}): ${body}`);
}

async function ensureIndex() {
  try {
    await meiliRequest("/indexes", {
      method: "POST",
      body: JSON.stringify({
        uid: config.meilisearchIndex,
        primaryKey: "id",
      }),
    });
  } catch (error) {
    if (!String(error.message).includes("index_already_exists")) {
      throw error;
    }
  }

  await meiliRequest(`/indexes/${config.meilisearchIndex}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["searchableText"],
      filterableAttributes: ["streamKind", "streamId", "serverId", "senderId", "deletedAt"],
      sortableAttributes: ["createdAt", "editedAt"],
    }),
  });

  state.meilisearchReady = true;
}

function normalizeAttachmentNames(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object") {
        return null;
      }
      return (
        attachment.filename ||
        attachment.original_filename ||
        attachment.name ||
        attachment.path ||
        attachment.url ||
        null
      );
    })
    .filter(Boolean);
}

function buildSearchableText(message) {
  const attachmentNames = normalizeAttachmentNames(message.attachments);
  return [
    message.content || "",
    message.sender_username || "",
    message.sender_display_name || "",
    message.server_name || "",
    message.channel_name || "",
    ...attachmentNames,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function buildSearchDocument(message, { tombstone = false } = {}) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const attachmentNames = normalizeAttachmentNames(attachments);

  return {
    id: message.id,
    streamKind: message.stream_kind,
    streamId: message.stream_id,
    serverId: message.server_id || null,
    serverName: message.server_name || null,
    channelName: message.channel_name || null,
    senderId: message.sender_id,
    senderUsername: message.sender_username,
    senderDisplayName: message.sender_display_name || null,
    content: tombstone ? "" : message.content || "",
    attachments,
    attachmentNames,
    replyToId: message.reply_to_id || null,
    createdAt: message.created_at || null,
    editedAt: message.edited_at || null,
    deletedAt: tombstone ? message.deleted_at || new Date().toISOString() : message.deleted_at || null,
    searchableText: tombstone ? attachmentNames.join("\n") : buildSearchableText(message),
  };
}

async function upsertDocument(document) {
  await meiliRequest(`/indexes/${config.meilisearchIndex}/documents`, {
    method: "POST",
    body: JSON.stringify([document]),
  });
}

async function handleActivityEvent(event) {
  state.lastEventType = event.event_type || null;
  state.lastProcessedAt = new Date().toISOString();

  switch (event.event_type) {
    case "message_created":
    case "message_edited": {
      if (!event.message?.id) {
        return;
      }
      await upsertDocument(buildSearchDocument(event.message));
      state.indexedDocuments += 1;
      state.lastMessageId = event.message.id;
      return;
    }
    case "message_deleted": {
      if (!event.message?.id) {
        return;
      }
      await upsertDocument(buildSearchDocument(event.message, { tombstone: true }));
      state.tombstonedDocuments += 1;
      state.lastMessageId = event.message.id;
      return;
    }
    default:
      return;
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      status: state.lastError ? "degraded" : "ok",
      ...state,
      config: {
        kafkaBrokers: config.kafkaBrokers,
        kafkaTopic: config.kafkaTopic,
        kafkaGroupId: config.kafkaGroupId,
        meilisearchUrl: config.meilisearchUrl,
        meilisearchIndex: config.meilisearchIndex,
      },
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

const kafka = new Kafka({
  clientId: "mnemosyne",
  brokers: config.kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: config.kafkaGroupId });

async function start() {
  await ensureIndex();
  await consumer.connect();
  await consumer.subscribe({ topic: config.kafkaTopic, fromBeginning: true });
  state.consumerConnected = true;

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value.toString("utf8"));
        await handleActivityEvent(event);
      } catch (error) {
        state.failedEvents += 1;
        state.lastError = String(error);
        console.error("[mnemosyne] failed to process event", error);
      }
    },
  });
}

async function shutdown(signal) {
  console.log(`[mnemosyne] received ${signal}, shutting down`);
  state.consumerConnected = false;
  try {
    await consumer.disconnect();
  } catch (error) {
    console.warn("[mnemosyne] consumer disconnect failed", error);
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

server.listen(port, () => {
  console.log(`[mnemosyne] search projection listening on http://localhost:${port}`);
});

start().catch((error) => {
  state.lastError = String(error);
  state.consumerConnected = false;
  console.error("[mnemosyne] startup failed", error);
});
