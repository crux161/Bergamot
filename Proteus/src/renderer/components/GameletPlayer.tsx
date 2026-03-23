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
  const playerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Keyboard-synthesis bridge: translates gamepad input into KeyboardEvents.
  // Active only when a controller is connected and the user toggles it on.
  // Games with native gamepad support (Emscripten, Ebitengine) don't need
  // this — they read the Gamepad API directly.
  const [bridgeEnabled, setBridgeEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { connected, bridgeActive } = useGamepad({
    synthesizeKeys: bridgeEnabled,
    keyMap: gamepadMapping,
    target: stageRef.current,
  });

  // Listen for postMessage events from the gamelet iframe (iframe mode only)
  useEffect(() => {
    if (type !== "iframe") return;

    const sendToIframe = (messageType: string, payload: unknown) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: messageType, payload }, "*");
      }
    };

    const handler = async (event: MessageEvent) => {
      try {
        // [PATCH]: Dynamically trust the current window's origin (Vite/Bun dev servers)
        const trustedOrigins = new Set(["http://localhost:8080", "null", window.location.origin]);
        let iframeOrigin: string | null = null;

        try {
          // [PATCH]: Pass window.location.href as the base to resolve relative gameUrls
          iframeOrigin = new URL(gameUrl, window.location.href).origin;
        } catch {
          iframeOrigin = null;
        }

        if (!trustedOrigins.has(event.origin) && (!iframeOrigin || event.origin !== iframeOrigin)) {
          return; // Ignore unauthorized messages
        }

        const data = typeof event.data === "object" && event.data !== null
          ? event.data as { type?: string; action?: string; payload?: unknown }
          : null;

        if (!data) return;

        const { type: messageType, action, payload } = data;

        // Ignore generic gamelet messages, process only Turtle API requests
        if (messageType !== "TURTLE_CMD") {
          return;
        }

        const scraper = window.api?.scraper;
        if (!scraper) {
          sendToIframe("TURTLE_ERROR", { message: "Scraper bridge is not available in preload." });
          return;
        }

        try {
          if (action === "search") {
            if (typeof payload !== "string") {
              sendToIframe("TURTLE_ERROR", { message: "Search payload must be a string." });
              return;
            }
            const result = await scraper.search(payload);
            sendToIframe("TURTLE_RESULT_SEARCH", result);
            return;
          }

          if (action === "episodes") {
            if (typeof payload !== "string") {
              sendToIframe("TURTLE_ERROR", { message: "Episode payload must be a string." });
              return;
            }
            const result = await scraper.getEpisodes(payload);
            sendToIframe("TURTLE_RESULT_EPISODES", result);
            return;
          }

          if (action === "stream") {
            if (typeof payload !== "string") {
              sendToIframe("TURTLE_ERROR", { message: "Stream payload must be a string." });
              return;
            }
            const result = await scraper.extractStreamUrl(payload);
            sendToIframe("TURTLE_RESULT_STREAM", result);
            return;
          }

          sendToIframe("TURTLE_ERROR", { message: `Unsupported Turtle action: ${String(action || "unknown")}` });
        } catch (error) {
          console.error("Turtle Backend Error:", error);
          const message = error instanceof Error ? error.message : "Unknown Turtle backend error";
          sendToIframe("TURTLE_ERROR", { message });
        }
      } catch (error) {
        console.error("[Proteus] Failed to process gamelet message:", error);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [gameUrl, type]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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

  const handleToggleFullscreen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      if (document.fullscreenElement === playerRef.current) {
        await document.exitFullscreen();
        return;
      }

      await playerRef.current?.requestFullscreen();
    } catch (error) {
      console.warn("[Proteus] Failed to toggle activity fullscreen:", error);
    }
  }, []);

  const handleOpenExternal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (type !== "iframe") {
      return;
    }

    try {
      const resolvedUrl = new URL(gameUrl, window.location.href).toString();
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.warn("[Proteus] Failed to open activity externally:", error);
    }
  }, [gameUrl, type]);

  return (
    <div className={`gamelet-player${isFullscreen ? " gamelet-player--fullscreen" : ""}`} ref={playerRef}>
      <div className="gamelet-player__viewport">
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
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="autoplay; gamepad; encrypted-media; fullscreen; picture-in-picture"
              title={`${gameName} Activity`}
            />
          )}
        </div>
      </div>

      <div className="gamelet-player__toolbar">
        <div className="gamelet-player__toolbar-spacer" />

        <div className="gamelet-player__toolbar-center">
          <button
            className={`gamelet-player__toolbar-btn gamelet-player__toolbar-btn--filled${bridgeActive ? " gamelet-player__toolbar-btn--active" : ""}`}
            onMouseDown={toggleBridge}
            title={
              !connected
                ? "No controller detected"
                : bridgeActive
                  ? "Disable gamepad bridge"
                  : "Enable gamepad bridge"
            }
            aria-label={bridgeActive ? "Disable gamepad bridge" : "Enable gamepad bridge"}
            aria-pressed={bridgeActive}
            disabled={!connected}
            type="button"
          >
            <PhIcon name="caret-down" size={16} />
          </button>

          <button
            className="gamelet-player__toolbar-btn gamelet-player__toolbar-btn--filled"
            onMouseDown={handleToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen activity" : "Fullscreen activity"}
            aria-label={isFullscreen ? "Exit fullscreen activity" : "Fullscreen activity"}
            type="button"
          >
            <PhIcon name="arrows-out" size={16} />
          </button>

          <button
            className="gamelet-player__toolbar-btn gamelet-player__toolbar-btn--danger"
            onMouseDown={handleLeave}
            title="Leave Activity"
            aria-label="Leave Activity"
            type="button"
          >
            <PhIcon name="sign-out" size={16} />
          </button>
        </div>

        <div className="gamelet-player__toolbar-side">
          <button
            className="gamelet-player__toolbar-btn gamelet-player__toolbar-btn--ghost"
            onMouseDown={handleOpenExternal}
            title={type === "iframe" ? `Open ${gameName} in a new window` : "External view is only available for iframe activities"}
            aria-label={type === "iframe" ? `Open ${gameName} in a new window` : "External view unavailable"}
            disabled={type !== "iframe"}
            type="button"
          >
            <PhIcon name="arrow-square-out" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
