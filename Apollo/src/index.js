/**
 * @module index
 * @description Apollo Media SFU entry point. Boots mediasoup workers, sets up
 * the HTTP health endpoint, WebSocket signaling, and graceful shutdown.
 */

const http = require("http");
const express = require("express");
const config = require("./config");
const WorkerPool = require("./media/worker-pool");
const RoomManager = require("./rooms/room-manager");
const SignalingServer = require("./signaling/ws-server");

/**
 * Initializes and starts the Apollo media server.
 * Spawns mediasoup workers, creates the room manager, mounts the HTTP
 * health-check route, attaches WebSocket signaling, and begins listening.
 * @async
 * @returns {Promise<void>}
 */
async function main() {
  console.log("[Apollo] Media SFU starting…");

  // --- mediasoup workers ---
  const workerPool = new WorkerPool();
  await workerPool.init();

  // --- Room manager ---
  const roomManager = new RoomManager(workerPool);

  // --- HTTP server (health + future REST endpoints) ---
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "apollo",
      workers: workerPool.workers.length,
      rooms: roomManager.rooms.size,
    });
  });

  const httpServer = http.createServer(app);

  // --- WebSocket signaling ---
  new SignalingServer(httpServer, roomManager);

  // --- Listen ---
  httpServer.listen(config.listenPort, () => {
    console.log(`[Apollo] Listening on port ${config.listenPort}`);
    console.log(`[Apollo] Health:    http://localhost:${config.listenPort}/health`);
    console.log(`[Apollo] Signaling: ws://localhost:${config.listenPort}/ws`);
  });

  // --- Graceful shutdown ---
  const shutdown = () => {
    console.log("[Apollo] Shutting down…");
    roomManager.closeAll();
    workerPool.close();
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Apollo] Fatal:", err);
  process.exit(1);
});
