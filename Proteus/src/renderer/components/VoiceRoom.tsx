import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Channel } from "phoenix";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
} from "../services/socket";
import type { LiveKitTokenPayload } from "../services/socket";
import { ScreenSharePicker } from "./ScreenSharePicker";

interface Props {
  /** The voice room identifier (e.g. "rocket-repair", a channel ID, or DM ID) */
  roomId: string;
  /** Display name for the current user — sent to Hermes for presence */
  username: string;
  /** Called when the user disconnects or leaves the voice room */
  onDisconnected: () => void;
}

/**
 * VoiceRoom — connects to a Hermes voice channel to retrieve a LiveKit
 * access token, then renders the LiveKit video conference UI.
 *
 * Lifecycle:
 *   1. Mount  → join Phoenix channel `voice:<roomId>`
 *   2. Hermes → pushes `livekit_token` event with `{token, url}`
 *   3. React  → renders `<LiveKitRoom>` pointed at Apollo
 *   4. Unmount / disconnect → leaves the Phoenix channel
 */
export const VoiceRoom: React.FC<Props> = ({ roomId, username, onDisconnected }) => {
  const [livekit, setLivekit] = useState<LiveKitTokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);

  // ── Phase 1: Join Phoenix voice channel & receive LiveKit token ──

  useEffect(() => {
    let mounted = true;

    try {
      const channel = joinVoiceChannel(
        roomId,
        username,
        // onToken — fires when Hermes pushes the signed LiveKit JWT
        (payload) => {
          if (mounted) {
            console.log("[VoiceRoom] Received LiveKit token for room:", roomId);
            setLivekit(payload);
          }
        },
        // onPresenceState
        (state) => {
          const participants = Object.keys(state);
          console.log("[VoiceRoom] Presence state:", participants);
        },
        // onPresenceDiff
        (diff) => {
          const joined = Object.keys(diff.joins);
          const left = Object.keys(diff.leaves);
          if (joined.length) console.log("[VoiceRoom] Joined:", joined);
          if (left.length) console.log("[VoiceRoom] Left:", left);
        },
      );

      channelRef.current = channel;
    } catch (err: any) {
      console.error("[VoiceRoom] Failed to join voice channel:", err);
      if (mounted) {
        setError(err.message || "Failed to connect to voice server");
      }
    }

    return () => {
      mounted = false;
      leaveVoiceChannel(roomId);
      channelRef.current = null;
    };
  }, [roomId, username]);

  // ── Disconnect handler ──

  const handleDisconnected = useCallback(() => {
    console.log("[VoiceRoom] Disconnected from LiveKit room:", roomId);
    leaveVoiceChannel(roomId);
    channelRef.current = null;
    onDisconnected();
  }, [roomId, onDisconnected]);

  // ── Error state ──

  if (error) {
    return (
      <div className="voice-room voice-room--error">
        <div className="voice-room__error-message">
          <span>Failed to join voice</span>
          <p>{error}</p>
          <button className="voice-room__retry-btn" onClick={onDisconnected}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting for token ──

  if (!livekit) {
    return (
      <div className="voice-room voice-room--connecting">
        <div className="voice-room__connecting">
          <div className="voice-room__spinner" />
          <span>Connecting to voice…</span>
        </div>
      </div>
    );
  }

  // ── Phase 2: Render LiveKit room ──

  return (
    <div className="voice-room">
      <LiveKitRoom
        serverUrl={livekit.url}
        token={livekit.token}
        connect={true}
        audio={true}
        video={true}
        onDisconnected={handleDisconnected}
        data-lk-theme="default"
      >
        {/* Pre-built video conference grid with controls */}
        <VideoConference />

        {/* Ensures remote audio tracks are rendered (heard) */}
        <RoomAudioRenderer />

        {/* Electron screen share picker — intercepts getDisplayMedia() */}
        <ScreenSharePicker />
      </LiveKitRoom>
    </div>
  );
};
