// useGamepad.ts
//
// React hook that wraps the browser Gamepad API. Provides:
//   1. Connection state (is a gamepad plugged in?)
//   2. Gamepad identity (name, button count, etc.)
//   3. Optional keyboard-synthesis mode — polls the gamepad each frame
//      and dispatches synthetic KeyboardEvents into a target element,
//      letting keyboard-only games respond to controller input.
//
// The keyboard bridge uses the W3C "Standard Gamepad" layout:
//   https://w3c.github.io/gamepad/#remapping
//
// PS4, Xbox, Switch Pro, and most modern controllers all report as
// "standard" mapping when connected via USB or Bluetooth.

import { useEffect, useRef, useState, useCallback } from "react";

/** Which gamepad buttons/axes map to which keyboard keys. */
export interface GamepadKeyMap {
  /** Map button index → key string (e.g. { 0: "k", 1: "l" }) */
  buttons?: Record<number, string>;
  /** Map axis index → [negativeKey, positiveKey] (e.g. { 0: ["a","d"] }) */
  axes?: Record<number, [string, string]>;
}

/** Info about the connected gamepad. */
export interface GamepadInfo {
  id: string;
  index: number;
  mapping: string;
  buttons: number;
  axes: number;
}

// ── Standard Gamepad → keyboard defaults ──
// Modeled on a typical N64/platformer layout:
//   Left stick  → WASD
//   D-pad       → Arrow keys
//   A (btn 0)   → K  (jump/confirm)
//   B (btn 1)   → L  (attack/cancel)
//   X (btn 2)   → J  (action)
//   Y (btn 3)   → I  (secondary)
//   LB (btn 4)  → Q
//   RB (btn 5)  → E
//   LT (btn 6)  → U
//   RT (btn 7)  → O
//   Start (9)   → Enter
//   Select (8)  → Shift

export const DEFAULT_BUTTON_MAP: Record<number, string> = {
  0: "k",        // A / Cross
  1: "l",        // B / Circle
  2: "j",        // X / Square
  3: "i",        // Y / Triangle
  4: "q",        // LB / L1
  5: "e",        // RB / R1
  6: "u",        // LT / L2
  7: "o",        // RT / R2
  8: "Shift",    // Select / Share
  9: "Enter",    // Start / Options
  12: "ArrowUp",
  13: "ArrowDown",
  14: "ArrowLeft",
  15: "ArrowRight",
};

export const DEFAULT_AXIS_MAP: Record<number, [string, string]> = {
  0: ["a", "d"],        // Left stick X → A/D
  1: ["w", "s"],        // Left stick Y → W/S (inverted: negative = up)
  2: ["ArrowLeft", "ArrowRight"],  // Right stick X → arrows
  3: ["ArrowUp", "ArrowDown"],     // Right stick Y → arrows
};

const DEFAULT_KEYMAP: GamepadKeyMap = {
  buttons: DEFAULT_BUTTON_MAP,
  axes: DEFAULT_AXIS_MAP,
};

const AXIS_DEADZONE = 0.25;

interface UseGamepadOptions {
  /** Enable the keyboard synthesis bridge. Default: false */
  synthesizeKeys?: boolean;
  /** Custom key mapping. Falls back to DEFAULT_KEYMAP. */
  keyMap?: GamepadKeyMap;
  /** Element to dispatch synthetic keyboard events into. Defaults to document. */
  target?: HTMLElement | null;
}

interface UseGamepadResult {
  /** Whether any gamepad is currently connected */
  connected: boolean;
  /** Info about the primary connected gamepad, if any */
  gamepad: GamepadInfo | null;
  /** Whether the keyboard bridge is currently active */
  bridgeActive: boolean;
}

export function useGamepad(options: UseGamepadOptions = {}): UseGamepadResult {
  const { synthesizeKeys = false, keyMap = DEFAULT_KEYMAP, target } = options;
  const [connected, setConnected] = useState(false);
  const [gamepadInfo, setGamepadInfo] = useState<GamepadInfo | null>(null);

  // Track which synthetic keys are currently "held" so we can send
  // keyup when the button/axis is released.
  const heldKeysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);

  // ── Connection events ──
  useEffect(() => {
    function onConnect(e: GamepadEvent) {
      console.log("[useGamepad] Connected:", e.gamepad.id);
      setConnected(true);
      setGamepadInfo({
        id: e.gamepad.id,
        index: e.gamepad.index,
        mapping: e.gamepad.mapping,
        buttons: e.gamepad.buttons.length,
        axes: e.gamepad.axes.length,
      });
    }

    function onDisconnect(e: GamepadEvent) {
      console.log("[useGamepad] Disconnected:", e.gamepad.id);
      // Check if any gamepads remain
      const pads = navigator.getGamepads();
      const remaining = pads ? Array.from(pads).find((g) => g !== null) : null;
      if (!remaining) {
        setConnected(false);
        setGamepadInfo(null);
      }
    }

    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);

    // Check if a gamepad is already connected (e.g. page reload)
    const pads = navigator.getGamepads();
    if (pads) {
      const first = Array.from(pads).find((g) => g !== null);
      if (first) {
        setConnected(true);
        setGamepadInfo({
          id: first.id,
          index: first.index,
          mapping: first.mapping,
          buttons: first.buttons.length,
          axes: first.axes.length,
        });
      }
    }

    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, []);

  // ── Keyboard synthesis loop ──
  const dispatchKey = useCallback(
    (key: string, type: "keydown" | "keyup") => {
      const el = target || document;
      el.dispatchEvent(
        new KeyboardEvent(type, {
          key,
          code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
          bubbles: true,
          cancelable: true,
        })
      );
    },
    [target]
  );

  useEffect(() => {
    if (!synthesizeKeys || !connected) return;

    const buttonMap = keyMap.buttons ?? {};
    const axisMap = keyMap.axes ?? {};
    const held = heldKeysRef.current;

    function poll() {
      const pads = navigator.getGamepads();
      const pad = pads ? Array.from(pads).find((g) => g !== null) : null;
      if (!pad) {
        rafRef.current = requestAnimationFrame(poll);
        return;
      }

      const activeKeys = new Set<string>();

      // Buttons
      for (const [idx, key] of Object.entries(buttonMap)) {
        const btn = pad.buttons[Number(idx)];
        if (btn && btn.pressed) {
          activeKeys.add(key);
        }
      }

      // Axes
      for (const [idx, [negKey, posKey]] of Object.entries(axisMap)) {
        const value = pad.axes[Number(idx)];
        if (value !== undefined) {
          if (value < -AXIS_DEADZONE) activeKeys.add(negKey);
          if (value > AXIS_DEADZONE) activeKeys.add(posKey);
        }
      }

      // Dispatch keydown for newly pressed keys
      for (const key of activeKeys) {
        if (!held.has(key)) {
          dispatchKey(key, "keydown");
          held.add(key);
        }
      }

      // Dispatch keyup for released keys
      for (const key of held) {
        if (!activeKeys.has(key)) {
          dispatchKey(key, "keyup");
          held.delete(key);
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    }

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(rafRef.current);
      // Release all held keys on cleanup
      for (const key of held) {
        dispatchKey(key, "keyup");
      }
      held.clear();
    };
  }, [synthesizeKeys, connected, keyMap, dispatchKey]);

  return {
    connected,
    gamepad: gamepadInfo,
    bridgeActive: synthesizeKeys && connected,
  };
}
