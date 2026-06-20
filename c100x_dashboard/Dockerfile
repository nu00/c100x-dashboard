# Immagine base con Node.js gia' pronto (multi-arch).
# Approccio volutamente semplice per un primo add-on: niente base-image S6/bashio.
FROM node:20-bookworm-slim

WORKDIR /app

# Installa le dipendenze (sfrutta la cache se package.json non cambia)
COPY app/package.json ./
RUN npm install --omit=dev

# Copia il resto dell'app
COPY app/ ./

# File QML/patch da caricare sul citofono via SSH
COPY citofono/ /citofono/

EXPOSE 8099

CMD ["node", "server.js"]
