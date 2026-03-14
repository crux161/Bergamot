# Janus — Core API & Identity Service

> Named for the Roman god of doorways, beginnings, and transitions.
> Janus guards the gate — every user, server, and channel passes through here.

**Language**: Python 3.12 | **Framework**: FastAPI | **Database**: PostgreSQL 16

## Architecture

| Layer | Files | Description |
|-------|-------|-------------|
| Models | `app/models/user.py`, `server.py`, `channel.py`, `server_member.py` | SQLAlchemy async models with UUID PKs and timestamps |
| Auth | `app/core/security.py`, `app/core/deps.py` | JWT (HS256) via python-jose, bcrypt password hashing, OAuth2 bearer |
| Routes | `app/api/routes/auth.py`, `servers.py`, `channels.py` | Registration, login, server CRUD, channel management |
| Infra | `Dockerfile`, `docker-compose.yml`, `alembic/` | Multi-stage build, health-checked PostgreSQL, async migrations |

## API Endpoints

```
POST /api/v1/auth/register   — Create account (username, email, password)
POST /api/v1/auth/login      — Login (OAuth2 form), returns JWT
GET  /api/v1/auth/me         — Current user profile

POST /api/v1/servers         — Create server (auto-creates #general channel)
GET  /api/v1/servers         — List user's servers
GET  /api/v1/servers/{id}    — Get server by ID

POST /api/v1/servers/{id}/channels  — Create channel (owner-only)
GET  /api/v1/servers/{id}/channels  — List channels in server
```

## Running

```bash
# Standalone (with its own PostgreSQL)
cd Janus
docker compose up --build

# Against shared infrastructure
cd Janus
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs` (Swagger UI).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `db` | PostgreSQL hostname |
| `POSTGRES_USER` | `janus` | Database user |
| `POSTGRES_PASSWORD` | `janus_secret` | Database password |
| `POSTGRES_DB` | `janus` | Database name |
| `SECRET_KEY` | — | JWT signing secret (shared with Hermes) |
