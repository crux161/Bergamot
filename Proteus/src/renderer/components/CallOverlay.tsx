import React, { useState, useEffect, useRef, useCallback } from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";

export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string | null;
  muted?: boolean;
  deafened?: boolean;
  speaking?: boolean;
  cameraOn?: boolean;
  screenSharing?: boolean;
}

export type ConnectionQuality = "excellent" | "good" | "poor" | "disconnected";

export interface CallState {
  active: boolean;
  type: "voice" | "video";
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  channelName?: string;
  participants?: CallParticipant[];
  connectionQuality?: ConnectionQuality;
  reconnecting?: boolean;
}

interface ConnectionStats {
  latency: number;
  packetLoss: number;
  bitrate: number;
  codec: string;
}

interface Props {
  call: CallState;
  onEnd: () => void;
}

const QUALITY_COLORS: Record<ConnectionQuality, string> = {
  excellent: "#3ba55d",
  good: "#faa61a",
  poor: "#ed4245",
  disconnected: "#747f8d",
};

const QUALITY_LABELS: Record<ConnectionQuality, string> = {
  excellent: "Excellent",
  good: "Fair",
  poor: "Poor",
  disconnected: "Disconnected",
};

export const CallOverlay: React.FC<Props> = ({ call, onEnd }) => {
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(call.type === "video");
  const [screenShare, setScreenShare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [pip, setPip] = useState(false);
  const startRef = useRef(Date.now());
  const overlayRef = useRef<HTMLDivElement>(null);

  const quality = call.connectionQuality || "excellent";
  const participants = call.participants || [
    { id: call.peerId, name: call.peerName, avatar: call.peerAvatar },
  ];

  // Simulated connection stats
  const [stats] = useState<ConnectionStats>({
    latency: 32,
    packetLoss: 0.1,
    bitrate: 128,
    codec: "opus",
  });

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleFullscreen = useCallback(() => {
    if (!overlayRef.current) return;
    if (!fullscreen) {
      overlayRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setFullscreen(!fullscreen);
  }, [fullscreen]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className="call-overlay" ref={overlayRef} data-fullscreen={fullscreen || undefined}>
      {/* Reconnecting banner */}
      {call.reconnecting && (
        <div className="call-overlay__reconnecting">
          <PhIcon name="arrows-clockwise" size={16} />
          Reconnecting...
        </div>
      )}

      {/* Top bar — channel info + connection quality */}
      <div className="call-overlay__top-bar">
        <div className="call-overlay__channel-info">
          {call.channelName && (
            <span className="call-overlay__channel-name">
              <PhIcon name={call.type === "voice" ? "microphone" : "video-camera"} size={14} />
              {call.channelName}
            </span>
          )}
          <span className="call-overlay__timer">{formatTime(elapsed)}</span>
        </div>
        <div className="call-overlay__top-actions">
          <Tooltip content={`Connection: ${QUALITY_LABELS[quality]}`} position="bottom">
            <div
              className="call-overlay__quality"
              onClick={() => setShowStats(!showStats)}
            >
              <div className="call-overlay__quality-bars">
                {[1, 2, 3].map((bar) => (
                  <div
                    key={bar}
                    className="call-overlay__quality-bar"
                    style={{
                      height: `${bar * 5 + 3}px`,
                      background:
                        (quality === "excellent" && bar <= 3) ||
                        (quality === "good" && bar <= 2) ||
                        (quality === "poor" && bar <= 1)
                          ? QUALITY_COLORS[quality]
                          : "var(--text-muted)",
                    }}
                  />
                ))}
              </div>
            </div>
          </Tooltip>
          <Tooltip content={pip ? "Exit Mini View" : "Mini View"} position="bottom">
            <div className="call-overlay__top-btn" onClick={() => setPip(!pip)}>
              <PhIcon name="picture-in-picture" size={18} />
            </div>
          </Tooltip>
          <Tooltip content={fullscreen ? "Exit Fullscreen" : "Fullscreen"} position="bottom">
            <div className="call-overlay__top-btn" onClick={handleFullscreen}>
              <PhIcon name={fullscreen ? "arrows-in" : "arrows-out"} size={18} />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Connection stats panel */}
      {showStats && (
        <div className="call-overlay__stats-panel">
          <div className="call-overlay__stats-title">Connection Stats</div>
          <div className="call-overlay__stats-row">
            <span>Latency</span><span>{stats.latency}ms</span>
          </div>
          <div className="call-overlay__stats-row">
            <span>Packet Loss</span><span>{stats.packetLoss}%</span>
          </div>
          <div className="call-overlay__stats-row">
            <span>Bitrate</span><span>{stats.bitrate} kbps</span>
          </div>
          <div className="call-overlay__stats-row">
            <span>Codec</span><span>{stats.codec}</span>
          </div>
        </div>
      )}

      {/* Main call area */}
      <div className="call-overlay__stage">
        {cameraOn ? (
          <div className="call-overlay__video-placeholder">
            <PhIcon name="video-camera" size={64} style={{ opacity: 0.3 }} />
            <div style={{ marginTop: 12, opacity: 0.5, fontSize: 14 }}>Camera preview</div>
          </div>
        ) : (
          <div className="call-overlay__participants">
            {participants.map((p) => (
              <div key={p.id} className={`call-overlay__participant ${p.speaking ? "call-overlay__participant--speaking" : ""}`}>
                {p.avatar ? (
                  <img className="call-overlay__peer-avatar" src={p.avatar} alt="" />
                ) : (
                  <div className="call-overlay__peer-avatar call-overlay__peer-avatar--fallback">
                    {p.name[0].toUpperCase()}
                  </div>
                )}
                <div className="call-overlay__peer-name">{p.name}</div>
                {(p.muted || p.deafened) && (
                  <div className="call-overlay__peer-indicators">
                    {p.muted && <PhIcon name="microphone-slash" size={14} />}
                    {p.deafened && <PhIcon name="speaker-slash" size={14} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="call-overlay__controls">
        <Tooltip content={cameraOn ? "Turn Off Camera" : "Turn On Camera"} position="top">
          <div
            className={`call-overlay__ctrl-btn ${cameraOn ? "call-overlay__ctrl-btn--active" : ""}`}
            onClick={() => setCameraOn(!cameraOn)}
          >
            <PhIcon name={cameraOn ? "video-camera" : "video-camera-slash"} size={22} />
          </div>
        </Tooltip>

        <Tooltip content={screenShare ? "Stop Sharing" : "Share Your Screen"} position="top">
          <div
            className={`call-overlay__ctrl-btn ${screenShare ? "call-overlay__ctrl-btn--active" : ""}`}
            onClick={() => setScreenShare(!screenShare)}
          >
            <PhIcon name="monitor-arrow-up" size={22} />
          </div>
        </Tooltip>

        <Tooltip content={muted ? "Unmute" : "Mute"} position="top">
          <div
            className={`call-overlay__ctrl-btn ${muted ? "call-overlay__ctrl-btn--muted" : ""}`}
            onClick={() => setMuted(!muted)}
          >
            <PhIcon name={muted ? "microphone-slash" : "microphone"} size={22} />
          </div>
        </Tooltip>

        <Tooltip content={deafened ? "Undeafen" : "Deafen"} position="top">
          <div
            className={`call-overlay__ctrl-btn ${deafened ? "call-overlay__ctrl-btn--muted" : ""}`}
            onClick={() => setDeafened(!deafened)}
          >
            <PhIcon name={deafened ? "speaker-slash" : "speaker-high"} size={22} />
          </div>
        </Tooltip>

        <Tooltip content="Disconnect" position="top">
          <div
            className="call-overlay__ctrl-btn call-overlay__ctrl-btn--end"
            onClick={onEnd}
          >
            <PhIcon name="phone-disconnect" size={22} />
          </div>
        </Tooltip>
      </div>
    </div>
  );
};
