# Contributing to Bergamot

## Prerequisites

| Service | Requirements |
|---------|-------------|
| Janus | Python 3.12+, pip |
| Hermes | Elixir 1.16+, OTP 26+ |
| Thoth | Rust 1.77+ (stable) |
| Heimdall | Rust 1.77+ (stable) |
| Apollo (Node) | Node.js 20+, npm |
| Apollo (gem) | Go 1.22+ |
| Proteus | Node.js 20+, npm, Electron |
| Anansi | Docker, Docker Compose |

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url> && cd Bergamot

# 2. Start shared infrastructure
make infra-up

# 3. Start the service you're working on
make janus    # or hermes, thoth, hiemdall, apollo, proteus
```

## Project Layout

Each service lives in its own directory and can be developed independently.
See `PANTHEON.md` for the mythology-inspired naming guide and `LABOR_DIVISION.md`
for architectural decisions and build prompts.

## Code Style

| Language | Style | Formatter |
|----------|-------|-----------|
| Python | PEP 8 | `black`, `ruff` |
| Elixir | Standard | `mix format` |
| Rust | Standard | `cargo fmt` |
| Go | Standard | `gofmt` |
| TypeScript | Strict mode | `prettier` |
| JavaScript | JSDoc annotated | `prettier` |

## Documentation

All public APIs should be documented using the language-appropriate format:

- **Python**: Google-style docstrings (Sphinx-compatible)
- **Elixir**: `@moduledoc` / `@doc` attributes (ExDoc-compatible)
- **Rust**: `///` doc comments (rustdoc-compatible)
- **Go**: Godoc comments (preceding declarations)
- **JavaScript**: JSDoc comments
- **TypeScript**: TSDoc / JSDoc comments

Generate documentation with:

```bash
make docs            # all services
make docs-janus      # Sphinx
make docs-hermes     # ExDoc
make docs-thoth      # cargo doc
make docs-hiemdall   # cargo doc
make docs-apollo     # godoc
```

## Kafka Topics

When adding a new Kafka topic, update:
1. `Anansi/docker-compose.yml` (topic creation in init-topics)
2. `Anansi/CONNECTION_GUIDE.md`
3. Root `docker-compose.yml` (if auto-create is disabled)
4. Root `README.md` topic table

## Shared Secrets

Janus and Hermes share a JWT signing secret. When changing it, update both:
- `Janus/.env` → `SECRET_KEY`
- `Hermes/.env` → `JWT_SECRET`
