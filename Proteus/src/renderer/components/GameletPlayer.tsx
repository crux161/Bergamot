import React, { useEffect, useRef, useCallback, useState } from "react";
import { PhIcon } from "./PhIcon";
import { GameletteView } from "./GameletteView";
import { useGamepad, GamepadKeyMap } from "../hooks/useGamepad";

interface Props {
  /** Display name shown in the toolbar */
  gameName: string;
  /** URL — either an iframe src or a `.wasm` path for Ebitengine games */
  gameUrl: string;
  /** "wasm" renders via GameletteView; "iframe" loads in a sandboxed iframe */
  type: "wasm" | "iframe";
  /** Custom gamepad → keyboard mapping from the game manifest */
  gamepadMapping?: GamepadKeyMap;
  onLeave: () => void;
}

export const GameletPlayer: React.FC<Props> = ({
  gameName,
  gameUrl,
  type,
  gamepadMapping,
  onLeave,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Keyboard-synthesis bridge: translates gamepad input into KeyboardEvents.
  // Active only when a controller is connected and the user toggles it on.
  // Games with native gamepad support (Emscripten, Ebitengine) don't need
  // this — they read the Gamepad API directly.
  const [bridgeEnabled, setBridgeEnabled] = useState(false);

  const { connected, gamepad, bridgeActive } = useGamepad({
    synthesizeKeys: bridgeEnabled,
    keyMap: gamepadMapping,
    target: stageRef.current,
  });

  // Listen for postMessage events from the gamelet iframe (iframe mode only)
  useEffect(() => {
    if (type !== "iframe") return;

    const handler = (event: MessageEvent) => {
      try {
        const iframeOrigin = new URL(gameUrl).origin;
        if (event.origin !== iframeOrigin) return;
      } catch {
        return;
      }
      console.log("[Proteus] Gamelet postMessage:", event.data);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [gameUrl, type]);

  // Use onMouseDown instead of onClick so the button fires even if
  // the iframe/canvas previously captured focus (onClick can be swallowed
  // when focus transitions from iframe → button on first click).
  const handleLeave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onLeave();
    },
    [onLeave]
  );

  const toggleBridge = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setBridgeEnabled((prev) => !prev);
  }, []);

  return (
    <div className="gamelet-player">
      {/* Game content — fills the available space above the control bar */}
      <div className="gamelet-player__stage" ref={stageRef}>
        {type === "wasm" ? (
          <div className="gamelet-player__canvas-host">
            <GameletteView wasmUrl={gameUrl} />
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={gameUrl}
            className="gamelet-player__iframe"
            sandbox="allow-scripts allow-same-origin"
            allow="autoplay; gamepad"
            title="Gamelet Activity"
          />
        )}
      </div>

      {/* Discord-style centered control bar */}
      <div className="gamelet-player__controls">
        <div className="gamelet-player__controls-label">
          <PhIcon name="game-controller" weight="fill" size={14} />
          <span>{gameName}</span>
        </div>

        <div className="gamelet-player__controls-buttons">
          {/* Gamepad indicator / bridge toggle */}
          <button
            className={
              "gamelet-player__ctrl-btn" +
              (connected ? " gamelet-player__ctrl-btn--gamepad-on" : "") +
              (bridgeActive ? " gamelet-player__ctrl-btn--bridge-active" : "")
            }
            onMouseDown={toggleBridge}
            title={
              !connected
                ? "No controller detected"
                : bridgeActive
                  ? "Gamepad bridge active — click to disable"
                  : "Enable gamepad → keyboard bridge"
            }
            disabled={!connected}
          >
            <PhIcon name="gamepad" size={20} />
          </button>

          {/* Leave activity */}
          <button
            className="gamelet-player__ctrl-btn gamelet-player__ctrl-btn--leave"
            onMouseDown={handleLeave}
            title="Leave Activity"
          >
            <PhIcon name="sign-out" size={20} />
          </button>
        </div>

        {/* Gamepad status — right side */}
        {connected && gamepad && (
          <div className="gamelet-player__controls-status">
            <span className="gamelet-player__gamepad-dot" />
            <span>{simplifyPadName(gamepad.id)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/** Shorten verbose gamepad IDs like "DualSense Wireless Controller (STANDARD GAMEPAD …)" */
function simplifyPadName(id: string): string {
  // Strip parenthesized vendor/product info
  const clean = id.replace(/\s*\(.*\)\s*$/, "").trim();
  // Truncate if still long
  return clean.length > 28 ? clean.slice(0, 28) + "…" : clean;
}
