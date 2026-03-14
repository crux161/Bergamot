/**
 * @module signaling/ws-server
 * @description WebSocket signaling server that brokers WebRTC negotiation
 * between clients and the mediasoup SFU via a JSON action protocol.
 */

const { WebSocketServer } = require("ws");

/**
 * WebSocket signaling server for WebRTC negotiation.
 *
 * Protocol (JSON messages):
 *
 *   Client → Server:
 *     { action: "join",              roomId, userId }
 *     { action: "getRouterCapabilities", roomId }
 *     { action: "connectTransport",  roomId, userId, transportId, dtlsParameters }
 *     { action: "produce",           roomId, userId, kind, rtpParameters }
 *     { action: "consume",           roomId, userId, producerId }
 *     { action: "leave",             roomId, userId }
 *
 *   Server → Client:
 *     { action: "joined",            sendTransportParams, recvTransportParams }
 *     { action: "routerCapabilities", rtpCapabilities }
 *     { action: "transportConnected" }
 *     { action: "produced",          producerId }
 *     { action: "consumed",          consumerId, producerId, kind, rtpParameters }
 *     { action: "newProducer",       userId, producerId, kind }  — broadcast
 *     { action: "peerLeft",          userId }                     — broadcast
 *     { action: "error",             message }
 */
class SignalingServer {
  /**
   * @param {import("http").Server} httpServer
   * @param {import("../rooms/room-manager")} roomManager
   */
  constructor(httpServer, roomManager) {
    this.roomManager = roomManager;
    /** @type {Map<string, Set<import("ws").WebSocket>>} roomId → connected sockets */
    this.roomSockets = new Map();

    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.wss.on("connection", (ws) => this._onConnection(ws));
    console.log("[Apollo] Signaling WebSocket server ready on /ws");
  }

  /**
   * Handles a new WebSocket connection: registers message and close listeners.
   * @param {import("ws").WebSocket} ws - The incoming WebSocket connection.
   * @private
   */
  _onConnection(ws) {
    ws._apolloRoomId = null;
    ws._apolloUserId = null;

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return this._send(ws, { action: "error", message: "Invalid JSON" });
      }
      try {
        await this._handleMessage(ws, msg);
      } catch (err) {
        console.error("[Apollo] signaling error:", err);
        this._send(ws, { action: "error", message: err.message });
      }
    });

    ws.on("close", () => {
      if (ws._apolloRoomId && ws._apolloUserId) {
        this._handleLeave(ws, ws._apolloRoomId, ws._apolloUserId);
      }
    });
  }

  /**
   * Dispatches a parsed signaling message to the appropriate handler.
   * @async
   * @param {import("ws").WebSocket} ws - The sender's socket.
   * @param {Object} msg - Parsed JSON message with an `action` field.
   * @returns {Promise<void>}
   * @private
   */
  async _handleMessage(ws, msg) {
    const { action } = msg;

    switch (action) {
      case "join": {
        const { roomId, userId } = msg;
        const room = await this.roomManager.getOrCreateRoom(roomId);
        const result = await room.addPeer(userId);

        ws._apolloRoomId = roomId;
        ws._apolloUserId = userId;
        this._addSocketToRoom(roomId, ws);

        this._send(ws, {
          action: "joined",
          sendTransportParams: result.sendTransportParams,
          recvTransportParams: result.recvTransportParams,
        });
        break;
      }

      case "getRouterCapabilities": {
        const room = await this.roomManager.getOrCreateRoom(msg.roomId);
        this._send(ws, {
          action: "routerCapabilities",
          rtpCapabilities: room.routerRtpCapabilities,
        });
        break;
      }

      case "connectTransport": {
        const { roomId, userId, transportId, dtlsParameters } = msg;
        const room = this.roomManager.rooms.get(roomId);
        const peer = room?.getPeer(userId);
        if (!peer) throw new Error("Peer not found");

        const transport =
          peer.sendTransport.id === transportId
            ? peer.sendTransport
            : peer.recvTransport;

        await transport.connect({ dtlsParameters });
        this._send(ws, { action: "transportConnected" });
        break;
      }

      case "produce": {
        const { roomId, userId, kind, rtpParameters } = msg;
        const room = this.roomManager.rooms.get(roomId);
        const peer = room?.getPeer(userId);
        if (!peer) throw new Error("Peer not found");

        const producer = await peer.sendTransport.produce({
          kind,
          rtpParameters,
        });
        peer.producers.set(producer.id, producer);

        producer.on("transportclose", () => {
          producer.close();
          peer.producers.delete(producer.id);
        });

        this._send(ws, { action: "produced", producerId: producer.id });

        // Notify all other peers in the room about the new producer
        this._broadcast(roomId, ws, {
          action: "newProducer",
          userId,
          producerId: producer.id,
          kind,
        });
        break;
      }

      case "consume": {
        const { roomId, userId, producerId } = msg;
        const room = this.roomManager.rooms.get(roomId);
        const peer = room?.getPeer(userId);
        if (!peer) throw new Error("Peer not found");

        // The consuming peer needs RTP capabilities sent by the client
        // For simplicity we pass rtpCapabilities from the router
        if (
          !room.router.canConsume({
            producerId,
            rtpCapabilities: room.routerRtpCapabilities,
          })
        ) {
          throw new Error("Cannot consume this producer");
        }

        const consumer = await peer.recvTransport.consume({
          producerId,
          rtpCapabilities: room.routerRtpCapabilities,
          paused: true, // Client resumes after receiving params
        });
        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          consumer.close();
          peer.consumers.delete(consumer.id);
        });
        consumer.on("producerclose", () => {
          consumer.close();
          peer.consumers.delete(consumer.id);
          this._send(ws, {
            action: "producerClosed",
            consumerId: consumer.id,
          });
        });

        this._send(ws, {
          action: "consumed",
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
        break;
      }

      case "resumeConsumer": {
        const { roomId, userId, consumerId } = msg;
        const room = this.roomManager.rooms.get(roomId);
        const peer = room?.getPeer(userId);
        const consumer = peer?.consumers.get(consumerId);
        if (consumer) await consumer.resume();
        break;
      }

      case "leave": {
        this._handleLeave(ws, msg.roomId, msg.userId);
        break;
      }

      default:
        this._send(ws, { action: "error", message: `Unknown action: ${action}` });
    }
  }

  /**
   * Processes a peer leaving: removes them from the room and broadcasts departure.
   * @param {import("ws").WebSocket} ws - The leaving peer's socket.
   * @param {string} roomId - Room the peer is leaving.
   * @param {string} userId - User ID of the departing peer.
   * @private
   */
  _handleLeave(ws, roomId, userId) {
    this.roomManager.removePeerFromRoom(roomId, userId);
    this._removeSocketFromRoom(roomId, ws);
    this._broadcast(roomId, ws, { action: "peerLeft", userId });
    ws._apolloRoomId = null;
    ws._apolloUserId = null;
  }

  // --- Socket room tracking ---

  /**
   * Associates a WebSocket with a room for broadcast tracking.
   * @param {string} roomId - The room identifier.
   * @param {import("ws").WebSocket} ws - The socket to track.
   * @private
   */
  _addSocketToRoom(roomId, ws) {
    if (!this.roomSockets.has(roomId)) {
      this.roomSockets.set(roomId, new Set());
    }
    this.roomSockets.get(roomId).add(ws);
  }

  /**
   * Removes a WebSocket from room tracking and cleans up empty entries.
   * @param {string} roomId - The room identifier.
   * @param {import("ws").WebSocket} ws - The socket to remove.
   * @private
   */
  _removeSocketFromRoom(roomId, ws) {
    const sockets = this.roomSockets.get(roomId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) this.roomSockets.delete(roomId);
  }

  /**
   * Sends a JSON message to every socket in a room except the excluded one.
   * @param {string} roomId - Target room.
   * @param {import("ws").WebSocket} excludeWs - Socket to skip (typically the sender).
   * @param {Object} msg - Message payload to serialize and send.
   * @private
   */
  _broadcast(roomId, excludeWs, msg) {
    const sockets = this.roomSockets.get(roomId);
    if (!sockets) return;
    const data = JSON.stringify(msg);
    for (const s of sockets) {
      if (s !== excludeWs && s.readyState === s.OPEN) {
        s.send(data);
      }
    }
  }

  /**
   * Sends a JSON message to a single WebSocket if it is open.
   * @param {import("ws").WebSocket} ws - Target socket.
   * @param {Object} msg - Message payload to serialize and send.
   * @private
   */
  _send(ws, msg) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

module.exports = SignalingServer;
