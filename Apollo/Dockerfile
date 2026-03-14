FROM node:20-bookworm-slim AS builder

# mediasoup needs python3, make, g++ for native compilation
RUN apt-get update && apt-get install -y \
    python3 python3-pip build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /apollo

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src src

# --- Runtime ---
FROM node:20-bookworm-slim

# mediasoup runtime needs these shared libs
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /apollo

COPY --from=builder /apollo/node_modules node_modules
COPY --from=builder /apollo/src src
COPY --from=builder /apollo/package.json .

EXPOSE 5000
EXPOSE 10000-10100/udp

CMD ["node", "src/index.js"]
