FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

ENV NODE_ENV=production

CMD ["npx", "tsx", "server.ts"]
