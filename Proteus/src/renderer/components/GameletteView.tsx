// GameletteView.tsx
//
// Reusable React component that loads and runs a Go WebAssembly module.
//
// Usage:
//   <GameletteView wasmUrl="/games/cascade.wasm" />
//
// How it works:
//   1. On mount, dynamically injects Go's `wasm_exec.js` into the DOM.
//   2. Once the glue script loads, fetches the `.wasm` binary.
//   3. Instantiates the module with `WebAssembly.instantiateStreaming`
//      (with a `fetch` fallback for environments that don't support it).
//   4. Creates the Go runtime (`new Go()`) and runs the instance.
//   5. After the Go program starts, Ebitengine creates a <canvas> on
//      document.body. We detect it with a MutationObserver and reparent
//      it into our own container <div> so it renders inside the React
//      component tree instead of floating on top of the app.
//
// Path resolution:
//   In Electron production builds the renderer loads via `file://` protocol.
//   Absolute paths like `/games/foo.js` would resolve to the filesystem
//   root, so all asset URLs are resolved relative to the current document
//   using `new URL(path, document.baseURI)`.
//
// Cleanup: on unmount the Go runtime is torn down, the canvas is removed,
// and the injected <script> tag is cleaned up.

import React, { useEffect, useRef, useState } from "react";

/**
 * Derive the path to wasm_exec.js from the WASM URL's directory.
 * E.g. "/games/Cascade/cascade.wasm" → "games/Cascade/wasm_exec.js"
 */
function getWasmExecPath(wasmUrl: string): string {
  const stripped = wasmUrl.replace(/^\/+/, "");
  const dir = stripped.substring(0, stripped.lastIndexOf("/"));
  return `${dir}/wasm_exec.js`;
}

/**
 * Resolve an asset path relative to the current document.
 *
 * - Dev  (`http://localhost:3000/index.html`)  → `http://localhost:3000/games/foo`
 * - Prod (`file:///…/dist/renderer/index.html`) → `file:///…/dist/renderer/games/foo`
 *
 * Strips any leading `/` so the path is always treated as relative.
 */
function resolveAssetUrl(path: string): string {
  const relative = path.replace(/^\/+/, "");
  return new URL(relative, document.baseURI).href;
}

interface Props {
  /** URL to the compiled `.wasm` binary (e.g. "/games/cascade.wasm"). */
  wasmUrl: string;
}

type Status = "loading" | "running" | "error";

export const GameletteView: React.FC<Props> = ({ wasmUrl }) => {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const goRef = useRef<Go | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ── Canvas reparenting ────────────────────────────────────────
    // Ebitengine appends its <canvas> to document.body. We watch for
    // it and move it into our host div so it lives inside the React
    // component tree and respects our layout.
    function adoptCanvas() {
      const canvas =
        document.querySelector("canvas[data-ebitengine]") ||
        document.body.querySelector(":scope > canvas");
      if (canvas && hostRef.current && !hostRef.current.contains(canvas)) {
        hostRef.current.appendChild(canvas);
      }
    }

    // Start observing body for the canvas Ebitengine will create
    observerRef.current = new MutationObserver(() => adoptCanvas());
    observerRef.current.observe(document.body, { childList: true });

    async function boot() {
      try {
        // ── Step 0: Install AudioContext tracker ─────────────────
        // Must happen before wasm_exec.js loads so any AudioContext
        // the Go program creates gets tracked for cleanup.
        installAudioContextTracker();

        // ── Step 1: Inject wasm_exec.js ──────────────────────────
        const scriptUrl = resolveAssetUrl(getWasmExecPath(wasmUrl));
        await loadScript(scriptUrl);
        if (cancelled) return;

        // ── Step 2: Verify the Go global is available ────────────
        if (typeof Go === "undefined") {
          throw new Error("Go runtime not found — wasm_exec.js failed to define the Go class");
        }

        // ── Step 3: Instantiate the WASM module ──────────────────
        const go = new Go();
        goRef.current = go;

        const wasmFullUrl = resolveAssetUrl(wasmUrl);
        console.log("[GameletteView] Fetching WASM from:", wasmFullUrl);

        let instance: WebAssembly.Instance;

        if (typeof WebAssembly.instantiateStreaming === "function") {
          // Preferred path: streaming compilation (fast, memory-efficient)
          const result = await WebAssembly.instantiateStreaming(
            fetch(wasmFullUrl),
            go.importObject
          );
          instance = result.instance;
        } else {
          // Fallback: fetch → arrayBuffer → instantiate
          const resp = await fetch(wasmFullUrl);
          const bytes = await resp.arrayBuffer();
          const result = await WebAssembly.instantiate(bytes, go.importObject);
          instance = result.instance;
        }

        if (cancelled) return;

        // ── Step 4: Run the Go program ───────────────────────────
        setStatus("running");

        // go.run() returns a promise that resolves when the Go program
        // exits (which for Ebitengine is never, unless the window closes).
        go.run(instance).catch((err: unknown) => {
          if (!cancelled) {
            console.warn("[GameletteView] Go runtime exited:", err);
          }
        });

        // Try to adopt the canvas immediately in case it was created
        // synchronously during go.run() (unlikely but defensive).
        adoptCanvas();
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[GameletteView] Failed to boot WASM:", msg);
          setErrorMsg(msg);
          setStatus("error");
        }
      }
    }

    boot();

    // ── Cleanup ────────────────────────────────────────────────────
    return () => {
      cancelled = true;

      // Stop watching for canvas additions
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // ── Kill all AudioContexts BEFORE tearing down Go ──────────
      // The WASM game creates AudioContext instances for music that
      // live in the browser, not in Go's runtime. go.exit() doesn't
      // close them, so they keep playing after unmount. We must find
      // and close them from the JS side.
      killAllAudioContexts();

      // Tear down the Go runtime if it was started
      if (goRef.current) {
        try {
          goRef.current.exit(0);
        } catch {
          // exit() throws by design — safe to ignore
        }
        goRef.current = null;
      }

      // Remove the injected wasm_exec.js <script> tag
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }

      // Remove ALL canvases Ebitengine created — both reparented ones
      // inside our host div and any that may still be on document.body.
      const allCanvases = document.querySelectorAll("canvas");
      allCanvases.forEach((c) => c.remove());

      // Remove the wasm_exec.js script tag by src (in case scriptRef
      // wasn't assigned, e.g. if the script was already present)
      const wasmScript = document.querySelector(
        `script[src*="wasm_exec"]`
      );
      if (wasmScript) wasmScript.remove();
    };
  }, [wasmUrl]);

  // ── Render ──────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="gamelet-wasm-host" ref={hostRef}>
        <div className="gamelet-wasm-host__status">
          <span style={{ color: "var(--status-danger, #f23f43)" }}>
            Failed to load game: {errorMsg}
          </span>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="gamelet-wasm-host" ref={hostRef}>
        <div className="gamelet-wasm-host__status">
          <span style={{ color: "var(--text-muted, #80848e)" }}>
            Loading WASM…
          </span>
        </div>
      </div>
    );
  }

  // When running, Ebitengine's canvas has been reparented into this div.
  return <div className="gamelet-wasm-host" ref={hostRef} />;
};

// ─── Audio cleanup ────────────────────────────────────────────────

/**
 * Track every AudioContext created during the page lifetime so we
 * can close them when the WASM game unmounts.
 *
 * Go's WASM runtime creates AudioContext instances via JS interop.
 * These live in the browser — go.exit() does NOT close them, so
 * music keeps playing after the React component unmounts. We
 * monkey-patch the AudioContext constructor to record each instance,
 * then close them all in the cleanup function.
 */
const trackedAudioContexts: AudioContext[] = [];
let audioCtxPatched = false;

function installAudioContextTracker(): void {
  if (audioCtxPatched) return;
  audioCtxPatched = true;

  const OriginalAudioContext =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!OriginalAudioContext) return;

  const Patched = function (
    this: AudioContext,
    ...args: ConstructorParameters<typeof AudioContext>
  ) {
    const ctx: AudioContext = new OriginalAudioContext(...args);
    trackedAudioContexts.push(ctx);
    console.log(
      `[GameletteView] AudioContext created (total tracked: ${trackedAudioContexts.length})`
    );
    return ctx;
  } as unknown as typeof AudioContext;

  // Preserve prototype so instanceof checks still work
  Patched.prototype = OriginalAudioContext.prototype;
  (window as any).AudioContext = Patched;
  if ((window as any).webkitAudioContext) {
    (window as any).webkitAudioContext = Patched;
  }
}

/**
 * Close and discard every tracked AudioContext. This immediately
 * stops all playing audio and releases hardware resources.
 */
function killAllAudioContexts(): void {
  let closed = 0;
  while (trackedAudioContexts.length > 0) {
    const ctx = trackedAudioContexts.pop()!;
    try {
      if (ctx.state !== "closed") {
        ctx.close();
        closed++;
      }
    } catch {
      // Already closed or invalid — safe to ignore
    }
  }
  if (closed > 0) {
    console.log(`[GameletteView] Closed ${closed} AudioContext(s)`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Dynamically load a <script> tag and resolve when it finishes. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Don't inject twice if wasm_exec.js is already on the page
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    console.log("[GameletteView] Attempting to load WASM script from:", script.src);

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
