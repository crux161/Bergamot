import React, { useEffect, useState } from "react";
import { PhIcon } from "./PhIcon";
import type { GamepadKeyMap } from "../hooks/useGamepad";

export interface GameletEntry {
  id: string;
  name: string;
  icon: string;
  url: string;
  /** "wasm" = load via GameletteView (Go/Ebitengine); "iframe" = legacy iframe embed */
  type: "wasm" | "iframe";
  version?: string;
  description?: string;
  /** Path to a cover/thumbnail image (relative to public/) */
  cover?: string;
  /** Brand color used as gradient fallback when no cover image */
  color?: string;
  /** Custom gamepad → keyboard mapping for the bridge */
  gamepadMapping?: GamepadKeyMap;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (gamelet: GameletEntry) => void;
}

export const GameletLibraryModal: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const [games, setGames] = useState<GameletEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (window.bergamot?.listGames() ?? Promise.resolve([]))
      .then((entries) => setGames(entries))
      .catch((err) => console.error("[GameletLibrary] Failed to list games:", err))
      .finally(() => setLoading(false));
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="gamelet-modal-overlay" onClick={onClose}>
      <div className="gamelet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gamelet-modal__header">
          <div className="gamelet-modal__title">
            <PhIcon name="rocket-launch" size={20} />
            <span>Activities</span>
          </div>
          <PhIcon
            name="x"
            size={20}
            className="gamelet-modal__close"
            onClick={onClose}
          />
        </div>

        <div className="gamelet-modal__body">
          {loading ? (
            <div className="gamelet-modal__empty">
              <PhIcon name="spinner" size={24} className="gamelet-modal__spinner" />
              <span>Loading activities…</span>
            </div>
          ) : games.length === 0 ? (
            <div className="gamelet-modal__empty">
              <PhIcon name="game-controller" size={32} />
              <span>No activities available</span>
            </div>
          ) : (
            <div className="gamelet-modal__list">
              {games.map((g) => (
                <div
                  key={g.id}
                  className="gamelet-modal__card"
                  onClick={() => {
                    onSelect(g);
                    onClose();
                  }}
                >
                  {/* Cover thumbnail — image or gradient+emoji fallback */}
                  <div
                    className="gamelet-modal__card-cover"
                    style={
                      g.cover
                        ? { backgroundImage: `url(${g.cover})` }
                        : {
                            background: `linear-gradient(135deg, ${g.color || "#5865f2"}, ${g.color ? g.color + "88" : "#5865f288"})`,
                          }
                    }
                  >
                    {!g.cover && (
                      <span className="gamelet-modal__card-cover-emoji">{g.icon}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="gamelet-modal__card-info">
                    <div className="gamelet-modal__card-name">{g.name}</div>
                    {g.description && (
                      <div className="gamelet-modal__card-desc">{g.description}</div>
                    )}
                  </div>

                  {/* Play button */}
                  <div className="gamelet-modal__card-action">
                    <PhIcon name="play" weight="fill" size={16} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
