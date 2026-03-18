import React, { useEffect, useState, useCallback, useRef } from "react";
import { PhIcon } from "./PhIcon";

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  display_id: string;
}

/**
 * ScreenSharePicker — modal that shows available screens and windows
 * when Electron intercepts a getDisplayMedia() call.
 *
 * It listens for the `onScreenShareRequested` bridge event, renders a
 * thumbnail grid, and resolves the selection (or cancellation) back to
 * the main process via `resolveScreenShare`.
 *
 * This component should be mounted globally inside the VoiceRoom so it
 * is present whenever LiveKit's screen share button is clicked.
 */
export const ScreenSharePicker: React.FC = () => {
  const [sources, setSources] = useState<ScreenSource[] | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Listen for screen share source list from the main process
  useEffect(() => {
    if (!window.bergamot?.onScreenShareRequested) return;

    const cleanup = window.bergamot.onScreenShareRequested((incoming) => {
      setSources(incoming);
    });

    cleanupRef.current = cleanup;
    return () => {
      cleanup();
      cleanupRef.current = null;
    };
  }, []);

  const handleSelect = useCallback((sourceId: string) => {
    window.bergamot?.resolveScreenShare(sourceId);
    setSources(null);
  }, []);

  const handleCancel = useCallback(() => {
    window.bergamot?.resolveScreenShare(null);
    setSources(null);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!sources) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sources, handleCancel]);

  if (!sources) return null;

  // Separate full-screen displays from application windows
  const screens = sources.filter((s) => s.id.startsWith("screen:"));
  const windows = sources.filter((s) => s.id.startsWith("window:"));

  return (
    <div className="screen-share-picker__overlay" onClick={handleCancel}>
      <div
        className="screen-share-picker"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="screen-share-picker__header">
          <h2 className="screen-share-picker__title">Share Your Screen</h2>
          <div
            className="screen-share-picker__close"
            onClick={handleCancel}
          >
            <PhIcon name="x" size={20} />
          </div>
        </div>

        {/* Screens section */}
        {screens.length > 0 && (
          <>
            <h3 className="screen-share-picker__section-title">Screens</h3>
            <div className="screen-share-picker__grid">
              {screens.map((source) => (
                <div
                  key={source.id}
                  className="screen-share-picker__source"
                  onClick={() => handleSelect(source.id)}
                >
                  <div className="screen-share-picker__thumbnail-wrap">
                    <img
                      className="screen-share-picker__thumbnail"
                      src={source.thumbnail}
                      alt={source.name}
                    />
                  </div>
                  <div className="screen-share-picker__source-label">
                    <span>{source.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Windows section */}
        {windows.length > 0 && (
          <>
            <h3 className="screen-share-picker__section-title">
              Application Windows
            </h3>
            <div className="screen-share-picker__grid">
              {windows.map((source) => (
                <div
                  key={source.id}
                  className="screen-share-picker__source"
                  onClick={() => handleSelect(source.id)}
                >
                  <div className="screen-share-picker__thumbnail-wrap">
                    <img
                      className="screen-share-picker__thumbnail"
                      src={source.thumbnail}
                      alt={source.name}
                    />
                  </div>
                  <div className="screen-share-picker__source-label">
                    {source.appIcon && (
                      <img
                        className="screen-share-picker__app-icon"
                        src={source.appIcon}
                        alt=""
                      />
                    )}
                    <span>{source.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer with cancel */}
        <div className="screen-share-picker__footer">
          <button
            className="screen-share-picker__cancel-btn"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
