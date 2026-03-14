/**
 * @module media/transport-manager
 * @description Factory for WebRTC transports used during media negotiation.
 */

const config = require("../config");

/**
 * Creates and configures WebRTC transports for producing or consuming media.
 *
 * Signaling flow:
 *   1. Client requests a transport → server creates WebRtcTransport, returns params
 *   2. Client calls device.createSendTransport() or device.createRecvTransport()
 *   3. Client calls transport.connect({ dtlsParameters }) → server connects
 *   4. For send: client calls transport.produce({ kind, rtpParameters })
 *      For recv: server creates consumer, client calls transport.consume()
 */

/**
 * Creates a WebRtcTransport on the given router and applies bitrate limits.
 * @async
 * @param {import("mediasoup").types.Router} router - The mediasoup router to create the transport on.
 * @returns {Promise<{transport: import("mediasoup").types.WebRtcTransport, params: Object}>}
 *   The raw transport instance and the serializable params to send to the client.
 */
async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(
    config.webRtcTransport
  );

  if (config.webRtcTransport.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(
        config.webRtcTransport.maxIncomingBitrate
      );
    } catch (_) {
      // Not fatal
    }
  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    },
  };
}

module.exports = { createWebRtcTransport };
