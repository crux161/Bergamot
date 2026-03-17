import React, { useState, useEffect, useRef } from "react";
import { Tooltip } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";

export interface CallState {
  active: boolean;
  type: "voice" | "video";
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
}

interface Props {
  call: CallState;
  onEnd: () => void;
}

export const CallOverlay: React.FC<Props> = ({ call, onEnd }) => {
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(call.type === "video");
  const [screenShare, setScreenShare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

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

  return (
    <div className="call-overlay">
      {/* Main call area */}
      <div className="call-overlay__stage">
        {cameraOn ? (
          <div className="call-overlay__video-placeholder">
            <PhIcon name="video-camera" size={64} style={{ opacity: 0.3 }} />
            <div style={{ marginTop: 12, opacity: 0.5, fontSize: 14 }}>Camera preview</div>
          </div>
        ) : (
          <div className="call-overlay__avatar-area">
            {call.peerAvatar ? (
              <img className="call-overlay__peer-avatar" src={call.peerAvatar} alt="" />
            ) : (
              <div className="call-overlay__peer-avatar call-overlay__peer-avatar--fallback">
                {call.peerName[0].toUpperCase()}
              </div>
            )}
            <div className="call-overlay__peer-name">{call.peerName}</div>
            <div className="call-overlay__call-status">
              {elapsed < 3 ? "Calling..." : formatTime(elapsed)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom control bar — circular buttons like Discord */}
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
