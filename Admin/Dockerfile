FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY public ./public
COPY src ./src

EXPOSE 9101

CMD ["node", "src/server.mjs"]
