FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY src ./src

EXPOSE 9102

CMD ["node", "src/index.mjs"]
