# Immagine base con Node.js gia' pronto (multi-arch).
# Approccio volutamente semplice per un primo add-on: niente base-image S6/bashio.
FROM node:20-bookworm-slim

WORKDIR /app

# ffmpeg: rimuxa (non ricodifica) lo stream fMP4/LL-HLS delle camera.* di HA in
# MPEG-TS, l'unico formato che il GStreamer del citofono (del 2017) sa leggere.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Installa le dipendenze (sfrutta la cache se package.json non cambia)
COPY app/package.json ./
RUN npm install --omit=dev

# Copia il resto dell'app
COPY app/ ./

# File QML/patch da caricare sul citofono via SSH
COPY citofono/ /citofono/

EXPOSE 8099

CMD ["node", "server.js"]
