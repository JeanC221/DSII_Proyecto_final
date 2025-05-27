FROM node:18-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodeuser && useradd -r -g nodeuser -m nodeuser

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY --chown=nodeuser:nodeuser . .

USER nodeuser

EXPOSE 5000

CMD ["node", "src/index.js"]