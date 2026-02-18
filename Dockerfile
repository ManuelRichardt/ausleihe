FROM node:22-alpine

# PM2 global installieren
RUN npm install pm2 -g

WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm install --production

# Restlichen Code kopieren
COPY . .

# Wichtig: express-generator startet über bin/www
CMD ["pm2-runtime", "start", "./bin/www", "--name", "express-app"]