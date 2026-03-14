FROM rust:1.77-bookworm AS builder

RUN apt-get update && apt-get install -y cmake libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*

WORKDIR /heimdall

# Cache dependency build
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Build real binary
COPY src src
RUN touch src/main.rs && cargo build --release

# --- Runtime ---
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /heimdall
COPY --from=builder /heimdall/target/release/heimdall .

CMD ["./heimdall"]
