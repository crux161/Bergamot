# ─── Proteus Makefile ──────────────────────────────────────────────
#
# Targets for building game assets (WASM) and the Electron app.

GAMES_DIR    := resources/feature_requests/games
WASM_OUT     := public/games
GOROOT       := $(shell go env GOROOT)

.PHONY: all cascade-wasm wasm-exec clean-wasm

# ── Cascade (Tetris-style puzzle game) ─────────────────────────────

all: cascade-wasm

# Compile the Go game to WebAssembly
# The go.mod lives inside GAMES_DIR, so we cd there and use an
# absolute output path back to Proteus/public/games/.
cascade-wasm: wasm-exec
	@echo "── Building Cascade WASM ──"
	@mkdir -p $(WASM_OUT)
	cd $(GAMES_DIR) && \
		GOOS=js GOARCH=wasm go build \
			-o $(CURDIR)/$(WASM_OUT)/cascade.wasm \
			./cmd/cascade-gui
	@echo "  → $(WASM_OUT)/cascade.wasm"
	@ls -lh $(WASM_OUT)/cascade.wasm

# Copy Go's official wasm_exec.js glue script (required to boot Go WASM)
wasm-exec:
	@mkdir -p $(WASM_OUT)
	@cp "$(GOROOT)/lib/wasm/wasm_exec.js" $(WASM_OUT)/wasm_exec.js
	@echo "  → $(WASM_OUT)/wasm_exec.js"

# Remove WASM build artifacts
clean-wasm:
	rm -f $(WASM_OUT)/cascade.wasm $(WASM_OUT)/wasm_exec.js
