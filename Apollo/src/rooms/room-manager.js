/**
 * @module rooms/room-manager
 * @description Manages the lifecycle of voice-channel rooms, creating them on
 * demand and tearing them down when the last peer leaves.
 */

const Room = require("./room");

/**
 * Manages the lifecycle of voice-channel rooms.
 * Creates rooms on demand, tears them down when empty.
 */
class RoomManager {
  /**
   * @param {import("../media/worker-pool")} workerPool
   */
  constructor(workerPool) {
    this.workerPool = workerPool;
    /** @type {Map<string, Room>} roomId → Room */
    this.rooms = new Map();
  }

  /**
   * Returns an existing room or creates a new one backed by a fresh router.
   * @async
   * @param {string} roomId - The voice-channel / room identifier.
   * @returns {Promise<Room>} The room instance.
   */
  async getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId);
    if (room) return room;

    const router = await this.workerPool.createRouter();
    room = new Room(roomId, router);
    this.rooms.set(roomId, room);
    console.log(`[Apollo] Room ${roomId} created`);
    return room;
  }

  /**
   * Removes a peer from a room and deletes the room if it becomes empty.
   * @param {string} roomId - The room to remove the peer from.
   * @param {string} userId - The user to remove.
   */
  removePeerFromRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePeer(userId);

    if (room.isEmpty()) {
      room.close();
      this.rooms.delete(roomId);
      console.log(`[Apollo] Room ${roomId} closed (empty)`);
    }
  }

  /**
   * Closes every room and clears the internal map. Used during shutdown.
   */
  closeAll() {
    for (const room of this.rooms.values()) {
      room.close();
    }
    this.rooms.clear();
  }
}

module.exports = RoomManager;
