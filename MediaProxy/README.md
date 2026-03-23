# Bergamot MediaProxy

Initial attachment and preview boundary for Bergamot parity work.

- Exposes `GET /health`
- Exposes `GET /media/<key>` with validated object lookup metadata
- Exposes `GET /preview?url=` for link-preview staging hooks

This is intentionally small so later image transforms, MIME sniffing, virus scan, and thumbhash work can land behind a dedicated service boundary.
