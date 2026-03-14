# Apollo — Voice & Video SFU

> Named for the Greek god of music, light, and the arts.
> Apollo orchestrates every voice and video stream in the realm.

Apollo contains two implementations that can operate independently or together:

## Node.js SFU (mediasoup)

**Language**: Node.js | **Framework**: mediasoup | **Signaling**: WebSocket

| Layer | File | Description |
|-------|------|-------------|
| Worker Pool | `src/media/worker-pool.js` | One mediasoup worker per CPU core, round-robin router allocation |
| Transport | `src/media/transport-manager.js` | WebRtcTransport creation with configurable IP/port ranges |
| Room | `src/rooms/room.js` | Room with peers, send/recv transports, producers, consumers |
| Room Manager | `src/rooms/room-manager.js` | Room lifecycle management, auto-destroy empty rooms |
| Signaling | `src/signaling/ws-server.js` | Full WebSocket signaling protocol (join, produce, consume, etc.) |

## Go SFU (gem)

**Language**: Go 1.22+ | **WebRTC**: pion/webrtc v4 | **Signaling**: Phoenix Channels

The `gem/` subdirectory contains a bespoke WebRTC transport library with SFU capabilities.

| Layer | File | Description |
|-------|------|-------------|
| Config | `pkg/webrtc_shim/config.go` | Dynamic codec negotiation (H.264, H.265, Opus) via `MediaCodecs` |
| Peer | `pkg/webrtc_shim/peer.go` | Phoenix signaling client, ICE/SDP exchange, `Accept`/`Dial` |
| Adapter | `pkg/webrtc_shim/adapter.go` | Bridges WebRTC tracks to gem's stream transport |
| SFU Room | `pkg/sfu/room.go` | Room hub: AddPeer, RemovePeer, HandleTrack, fan-out wiring |
| SFU Track | `pkg/sfu/track.go` | PublishedTrack with 1-to-N RTP fan-out via `WriteRTP` |

### SFU Data Flow

```
Publisher                    Room                     Subscribers
   │                          │                          │
   │── TrackRemote ──────────▶│                          │
   │                          │── TrackLocalStaticRTP ──▶│ Peer A
   │                          │── TrackLocalStaticRTP ──▶│ Peer B
   │                          │── TrackLocalStaticRTP ──▶│ Peer C
   │                          │                          │
   │  ReadRTP() loop ────────▶│  fanOutPacket()          │
   │  (one read)              │  (N writes)              │
```

### Examples

- `examples/relay_node/` — Legacy 1-to-1 bidirectional relay
- `examples/sfu_node/` — SFU room that accepts N peers for 1-to-N fan-out

## Running

```bash
# Node.js mediasoup
cd Apollo
npm install
npm start

# Docker (mediasoup)
cd Apollo
docker compose up --build

# Go gem SFU example
cd Apollo/gem
go run examples/sfu_node/main.go
```

## Environment Variables (Node.js)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP/WS listen port |
| `MEDIASOUP_LISTEN_IP` | `0.0.0.0` | mediasoup bind address |
| `MEDIASOUP_ANNOUNCED_IP` | `127.0.0.1` | Public IP for ICE candidates |
| `RTC_MIN_PORT` | `10000` | UDP port range start |
| `RTC_MAX_PORT` | `10100` | UDP port range end |

## Environment Variables (Go gem)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEM_SIGNALING_URL` | `ws://127.0.0.1:4000/ws/sankaku/websocket` | Phoenix signaling endpoint |
| `GEM_SFU_PEER_ID` | `sfu-node-1` | SFU node peer identity |
| `GEM_SFU_DEVICE_ID` | `sfu-device-1` | Device UUID |
| `GEM_SFU_AUTH_TOKEN` | — | Signaling auth token |
| `GEM_SFU_ROOM_ID` | `default-room` | Room/voice channel ID |
| `GEM_SFU_CODECS` | `video/h265,audio/opus` | Comma-separated codec list |
