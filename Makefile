SHELL := /bin/bash

DOCKER_COMPOSE ?= docker compose
DOCKER ?= docker
ROOT_COMPOSE := $(DOCKER_COMPOSE) -p bergamot-root -f docker-compose.yml
ANANSI_COMPOSE := $(DOCKER_COMPOSE) -f Anansi/docker-compose.yml
JANUS_COMPOSE := $(DOCKER_COMPOSE) -f Janus/docker-compose.yml
HERMES_COMPOSE := $(DOCKER_COMPOSE) -f Hermes/docker-compose.yml
THOTH_COMPOSE := $(DOCKER_COMPOSE) -f Thoth/docker-compose.yml
HIEMDALL_COMPOSE := $(DOCKER_COMPOSE) -f Hiemdall/docker-compose.yml
EDGE_COMPOSE := $(DOCKER_COMPOSE) -p bergamot-edge -f docker-compose.edge.yml
LEGACY_APOLLO_COMPOSE := $(DOCKER_COMPOSE) -f Apollo/docker-compose.yml

.PHONY: infra-up infra-down janus hermes thoth hiemdall apollo proteus admin media-proxy mnemosyne backfill-activity \
       backend-up backend-down edge-up edge-down docker-build docker-up docker-down \
       docs docs-janus docs-hermes docs-thoth docs-hiemdall docs-apollo

# ============================================================
# Infrastructure
# ============================================================

## Boot shared databases and Kafka broker
infra-up:
	$(ANANSI_COMPOSE) up -d
	$(ROOT_COMPOSE) up -d janus-postgres thoth-scylla hiemdall-redis atlas atlas-init apollo

## Spin down shared infrastructure
infra-down:
	$(ROOT_COMPOSE) down
	$(ANANSI_COMPOSE) down

# ============================================================
# Services
# ============================================================

## Start the Core API (Python/FastAPI)
janus:
	cd Janus && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

## Start the Real-Time Gateway (Elixir/Phoenix)
hermes:
	cd Hermes && mix phx.server

## Start the Message Storage Service (Rust)
thoth:
	cd Thoth && cargo run

## Start the Read State Worker (Rust)
hiemdall:
	cd Hiemdall && cargo run

## Start the Voice/Video SFU (Node.js mediasoup)
apollo:
	cd Apollo && node src/index.js

proteus:
	cd Proteus && npx concurrently -k "npm run dev" "npx wait-on tcp:3000 file:dist/main/main.js file:dist/main/preload.js && npx electron ."

admin:
	cd Admin && node src/server.mjs

media-proxy:
	cd MediaProxy && node src/server.mjs

mnemosyne:
	cd Mnemosyne && node src/index.mjs

backfill-activity:
	cd Janus && source venv/bin/activate && python scripts/backfill_activity.py

# ============================================================
# Backend (infrastructure + all services, local)
# ============================================================

PIDFILE := .backend.pids
LOGDIR  := .backend-logs

## Start infrastructure then all backend services in the background
backend-up: infra-up
	@mkdir -p $(LOGDIR)
	@rm -f $(PIDFILE)
	@echo "⏳ Waiting for infrastructure…"
	@sleep 3
	@echo "Starting backend services…"
	@cd Janus && source venv/bin/activate && \
		nohup uvicorn app.main:app --reload --port 8000 > ../$(LOGDIR)/janus.log 2>&1 & echo $$! >> $(PIDFILE)
	@cd Hermes && \
		nohup mix phx.server > ../$(LOGDIR)/hermes.log 2>&1 & echo $$! >> $(PIDFILE)
	@cd Thoth && \
		nohup cargo run > ../$(LOGDIR)/thoth.log 2>&1 & echo $$! >> $(PIDFILE)
	@cd Hiemdall && \
		nohup cargo run > ../$(LOGDIR)/hiemdall.log 2>&1 & echo $$! >> $(PIDFILE)
	@cd Apollo && \
		nohup node src/index.js > ../$(LOGDIR)/apollo.log 2>&1 & echo $$! >> $(PIDFILE)
	@echo ""
	@echo "✅ All backend services started."
	@echo "   PIDs  → $(PIDFILE)"
	@echo "   Logs  → $(LOGDIR)/"
	@echo ""
	@echo "   Stop with:  make backend-down"

## Gracefully stop all backend services then infrastructure
backend-down:
	@if [ -f $(PIDFILE) ]; then \
		echo "Stopping backend services…"; \
		while read -r pid; do \
			if kill -0 "$$pid" 2>/dev/null; then \
				kill "$$pid" && echo "  Stopped PID $$pid"; \
			fi; \
		done < $(PIDFILE); \
		rm -f $(PIDFILE); \
		echo "✅ All services stopped."; \
	else \
		echo "No $(PIDFILE) found — nothing to stop."; \
	fi
	@$(MAKE) infra-down

## Start edge/runtime helpers (Caddy, Meilisearch, ClamAV)
edge-up:
	-@$(DOCKER) rm -f bergamot-edge bergamot-admin bergamot-meilisearch bergamot-mnemosyne bergamot-media-proxy >/dev/null 2>&1
	$(EDGE_COMPOSE) up -d meilisearch admin mnemosyne media-proxy edge-proxy

## Stop edge/runtime helpers
edge-down:
	$(EDGE_COMPOSE) down
	-@$(DOCKER) rm -f bergamot-edge bergamot-admin bergamot-meilisearch bergamot-mnemosyne bergamot-media-proxy >/dev/null 2>&1

# ============================================================
# Documentation
# ============================================================

## Generate documentation for all services
docs: docs-janus docs-hermes docs-thoth docs-hiemdall docs-apollo
	@echo ""
	@echo "Documentation generated for all services."
	@echo "  Janus:    Janus/docs/_build/html/"
	@echo "  Hermes:   Hermes/doc/"
	@echo "  Thoth:    Thoth/target/doc/"
	@echo "  Heimdall: Hiemdall/target/doc/"
	@echo "  Apollo:   Apollo/gem — use 'go doc' or godoc server"

## Generate Sphinx docs for Janus (Python)
docs-janus:
	@echo "==> Generating Janus docs (Sphinx)..."
	@if [ -d Janus/docs ]; then \
		cd Janus && sphinx-build -b html docs docs/_build/html; \
	else \
		echo "  Sphinx not configured yet. Run: cd Janus && sphinx-quickstart docs"; \
	fi

## Generate ExDoc for Hermes (Elixir)
docs-hermes:
	@echo "==> Generating Hermes docs (ExDoc)..."
	cd Hermes && mix docs

## Generate rustdoc for Thoth
docs-thoth:
	@echo "==> Generating Thoth docs (cargo doc)..."
	cd Thoth && cargo doc --no-deps --document-private-items

## Generate rustdoc for Heimdall
docs-hiemdall:
	@echo "==> Generating Heimdall docs (cargo doc)..."
	cd Hiemdall && cargo doc --no-deps --document-private-items

## Generate godoc for Apollo gem (Go)
docs-apollo:
	@echo "==> Apollo gem docs available via:"
	@echo "    cd Apollo/gem && go doc ./..."
	@echo "    Or run: cd Apollo/gem && godoc -http=:6060"
	@echo "    Then visit http://localhost:6060/pkg/gem/"

## Generate JSDoc for Apollo Node.js
docs-apollo-node:
	@echo "==> Generating Apollo Node.js docs (JSDoc)..."
	@if command -v jsdoc >/dev/null 2>&1; then \
		cd Apollo && jsdoc -c jsdoc.json -d docs/html src/; \
	else \
		echo "  JSDoc not installed. Run: npm install -g jsdoc"; \
	fi

# ============================================================
# Docker
# ============================================================

## Build all Docker images
docker-build:
	$(JANUS_COMPOSE) build
	$(HERMES_COMPOSE) build
	$(THOTH_COMPOSE) build
	$(HIEMDALL_COMPOSE) build
	$(EDGE_COMPOSE) build admin mnemosyne media-proxy

## Start the full dockerized local stack
docker-up:
	$(ANANSI_COMPOSE) up -d
	-@$(LEGACY_APOLLO_COMPOSE) down >/dev/null 2>&1
	-@$(DOCKER) rm -f apollo-apollo-1 >/dev/null 2>&1
	-@$(DOCKER) rm -f atlas atlas-init apollo >/dev/null 2>&1
	$(ROOT_COMPOSE) up -d atlas atlas-init apollo
	-@$(DOCKER) rm -f bergamot-edge bergamot-admin bergamot-meilisearch bergamot-mnemosyne bergamot-media-proxy >/dev/null 2>&1
	$(EDGE_COMPOSE) up -d meilisearch admin mnemosyne media-proxy edge-proxy
	$(JANUS_COMPOSE) up -d
	$(HERMES_COMPOSE) up -d
	$(THOTH_COMPOSE) up -d
	$(HIEMDALL_COMPOSE) up -d

## Stop all Docker services (reverse order of docker-up)
docker-down:
	$(HIEMDALL_COMPOSE) down
	$(THOTH_COMPOSE) down
	$(HERMES_COMPOSE) down
	$(JANUS_COMPOSE) down
	$(EDGE_COMPOSE) down
	-@$(DOCKER) rm -f bergamot-edge bergamot-admin bergamot-meilisearch bergamot-mnemosyne bergamot-media-proxy >/dev/null 2>&1
	-@$(DOCKER) rm -f atlas atlas-init apollo >/dev/null 2>&1
	-@$(LEGACY_APOLLO_COMPOSE) down >/dev/null 2>&1
	-@$(DOCKER) rm -f apollo-apollo-1 >/dev/null 2>&1
	$(ANANSI_COMPOSE) down
