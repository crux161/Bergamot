.PHONY: infra-up infra-down janus hermes thoth hiemdall apollo proteus \
       docs docs-janus docs-hermes docs-thoth docs-hiemdall docs-apollo

# ============================================================
# Infrastructure
# ============================================================

## Boot shared databases and Kafka broker
infra-up:
	docker compose up -d

## Spin down shared infrastructure
infra-down:
	docker compose down

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

## Start the Desktop Client (Electron/React)
proteus:
	cd Proteus && npm start

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
	docker compose -f Janus/docker-compose.yml build
	docker compose -f Hermes/docker-compose.yml build
	docker compose -f Thoth/docker-compose.yml build
	docker compose -f Hiemdall/docker-compose.yml build
	docker compose -f Apollo/docker-compose.yml build

## Start everything (infrastructure + all services with their own DBs)
docker-up:
	docker compose -f Anansi/docker-compose.yml up -d
	docker compose -f Janus/docker-compose.yml up -d
	docker compose -f Hermes/docker-compose.yml up -d

## Stop all Docker services
docker-down:
	docker compose -f Hermes/docker-compose.yml down
	docker compose -f Janus/docker-compose.yml down
	docker compose -f Anansi/docker-compose.yml down
