/**
 * @module rooms/room
 * @description Represents a single voice-channel room backed by a mediasoup
 * Router, tracking peers and their media transports, producers, and consumers.
 */

const { createWebRtcTransport } = require("../media/transport-manager");

/**
 * @typedef {Object} Peer
 * @property {string} userId - Unique user identifier.
 * @property {import("mediasoup").types.WebRtcTransport} sendTransport - Upload transport.
 * @property {import("mediasoup").types.WebRtcTransport} recvTransport - Download transport.
 * @property {Map<string, import("mediasoup").types.Producer>} producers - Active producers keyed by producer ID.
 * @property {Map<string, import("mediasoup").types.Consumer>} consumers - Active consumers keyed by consumer ID.
 */

/**
 * A Room maps 1:1 to a voice channel.
 * It holds a mediasoup Router and tracks peers + their transports/producers/consumers.
 */
class Room {
  /**
   * @param {string} roomId — matches a Bergamot channel_id
   * @param {import("mediasoup").types.Router} router
   */
  constructor(roomId, router) {
    this.roomId = roomId;
    this.router = router;
    /** @type {Map<string, Peer>} userId → Peer */
    this.peers = new Map();
  }

  /**
   * The RTP capabilities of the underlying mediasoup Router.
   * @type {import("mediasoup").types.RtpCapabilities}
   */
  get routerRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  /**
   * Adds a peer to the room, creating dedicated send and receive transports.
   * @async
   * @param {string} userId - The unique identifier of the joining user.
   * @returns {Promise<{sendTransportParams: Object, recvTransportParams: Object}>}
   *   Transport parameters the client needs to initialize its device transports.
   */
  async addPeer(userId) {
    const sendResult = await createWebRtcTransport(this.router);
    const recvResult = await createWebRtcTransport(this.router);

    const peer = {
      userId,
      sendTransport: sendResult.transport,
      recvTransport: recvResult.transport,
      /** @type {Map<string, import("mediasoup").types.Producer>} */
      producers: new Map(),
      /** @type {Map<string, import("mediasoup").types.Consumer>} */
      consumers: new Map(),
    };

    this.peers.set(userId, peer);

    return {
      sendTransportParams: sendResult.params,
      recvTransportParams: recvResult.params,
    };
  }

  /**
   * Removes a peer, closing their transports and freeing resources.
   * @param {string} userId - The user to remove.
   */
  removePeer(userId) {
    const peer = this.peers.get(userId);
    if (!peer) return;

    peer.sendTransport.close();
    peer.recvTransport.close();
    this.peers.delete(userId);
  }

  /**
   * Retrieves a peer by user ID.
   * @param {string} userId - The user to look up.
   * @returns {Peer|undefined} The peer object, or undefined if not found.
   */
  getPeer(userId) {
    return this.peers.get(userId);
  }

  /**
   * Checks whether the room has no peers.
   * @returns {boolean} True if the room is empty.
   */
  isEmpty() {
    return this.peers.size === 0;
  }

  /**
   * Closes the underlying router and clears all peer state.
   */
  close() {
    this.router.close();
    this.peers.clear();
  }
}

module.exports = Room;
