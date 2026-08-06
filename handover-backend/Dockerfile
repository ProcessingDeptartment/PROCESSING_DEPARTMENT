FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=4000
ENV DB_PATH=/data/handovers.db

VOLUME ["/data"]
EXPOSE 4000

CMD ["node", "server.js"]
