# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Kopiere package.json und installiere Dependencies
COPY package*.json ./
RUN npm install --production

# Kopiere den Rest der App
COPY server.js ./
COPY data/ ./data/

# Exponiere Port
EXPOSE 3000

# Umgebungsvariable
ENV PORT=3000
ENV KITCHEN_PASSWORD=admin123

# Starte Server
CMD ["node", "server.js"]
