/**
 * @module config
 * @description Centralized configuration for Apollo. Values are sourced from
 * environment variables with sensible defaults for local development.
 */

require("dotenv").config();

/**
 * @typedef {Object} ApolloConfig
 * @property {number} listenPort - HTTP and WebSocket signaling port.
 * @property {Object} worker - mediasoup Worker settings.
 * @property {number} worker.rtcMinPort - Lower bound of the RTC port range.
 * @property {number} worker.rtcMaxPort - Upper bound of the RTC port range.
 * @property {string} worker.logLevel - mediasoup log verbosity.
 * @property {string[]} worker.logTags - mediasoup log tags to enable.
 * @property {Object} router - mediasoup Router settings.
 * @property {Array<Object>} router.mediaCodecs - Supported media codecs (Opus audio, VP8 video).
 * @property {Object} webRtcTransport - WebRtcTransport creation options.
 * @property {Array<{ip: string, announcedIp: ?string}>} webRtcTransport.listenIps - Listen/announced IP pairs.
 * @property {number} webRtcTransport.initialAvailableOutgoingBitrate - Initial outgoing bitrate (bps).
 * @property {number} webRtcTransport.minimumAvailableOutgoingBitrate - Minimum outgoing bitrate (bps).
 * @property {number} webRtcTransport.maxSctpMessageSize - Maximum SCTP message size in bytes.
 * @property {number} webRtcTransport.maxIncomingBitrate - Cap on incoming bitrate (bps).
 */

/** @type {ApolloConfig} */
module.exports = {
  // HTTP + WebSocket signaling port
  listenPort: parseInt(process.env.PORT || "5000", 10),

  // mediasoup Worker settings
  worker: {
    rtcMinPort: parseInt(process.env.RTC_MIN_PORT || "10000", 10),
    rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || "10100", 10),
    logLevel: process.env.MEDIASOUP_LOG_LEVEL || "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },

  // Router media codecs — audio-first, video optional
  router: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  },

  // WebRtcTransport options
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null,
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
  },
};
