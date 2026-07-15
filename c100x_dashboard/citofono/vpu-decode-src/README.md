# Perché questi binari esistono

Il citofono usa GStreamer + `imxvpudec` (il wrapper del decoder hardware VPU
i.MX6) per qualunque cosa video. Abbiamo scoperto, con test ripetuti, un bug
**noto e documentato** in `gstreamer-imx` (es.
[Freescale/gstreamer-imx#271](https://github.com/Freescale/gstreamer-imx/issues/271),
e discussioni della community NXP): il wrapper non chiama mai
`gst_video_decoder_set_latency()`, quindi la pipeline GStreamer non sa quanto
tempo impiega davvero il VPU a decodificare. Per un **file** non si nota; per
una sorgente **live** (qualunque telecamera), dopo un po' GStreamer si
convince che i fotogrammi arrivano "in ritardo" e comincia a scartarli, fino a
bloccarsi del tutto. Abbiamo provato le contromisure note (decoder software
`avdec_h264` — non installabile, manca il plugin `libav`; un `queue` più
capiente — rompe `hlsdemux` in modo diverso su questa versione specifica di
GStreamer del 2017) senza successo.

La soluzione: **bypassare GStreamer del tutto**, parlando direttamente con
`/dev/mxc_vpu` (l'API nativa del VPU) tramite `libimxvpuapi` — una libreria
**ufficiale Freescale/NXP, open source (LGPL)**, già installata sul citofono
stesso (usata internamente proprio da `gstreamer-imx`). Il nostro programma
(`vpu-fb-decode`) la chiama direttamente: nessun bug di temporizzazione,
perché non c'è nessuna pipeline GStreamer di mezzo.

## I due binari

### `ffmpeg-armhf`

Fa **solo** rete + demux + ripacchettizzazione (leggero): legge l'HLS/URL
diretto, e scrive su stdout un flusso H.264 Annex-B puro (con AUD inseriti,
così il nostro decoder sa dove finisce ogni fotogramma). Compilato:

- **Staticamente**, per non dipendere da nessuna libreria di sistema del
  citofono.
- Con **musl** invece di **glibc** — un binario glibc completamente statico
  crasha (`Fatal glibc error: dl-call-libc-early-init.c`) se deve risolvere un
  nome host (DNS), un problema noto e mai davvero risolto di glibc + link
  statico. musl non ha questo problema (il suo resolver DNS non passa da
  moduli NSS caricati dinamicamente).
- Con **OpenSSL** (anch'esso compilato con musl) per il supporto `https`.
- Con un set minimo di funzionalità (`--disable-everything` + solo quello che
  serve: decoder H.264/MJPEG, demuxer HLS/MOV/MPEG-TS, muxer H.264/rawvideo,
  filtri scale/format) — per tenere il binario piccolo (~5MB) e la
  compilazione rapida.

### `vpu-fb-decode`

Il nostro programma, basato sull'esempio ufficiale
[`decode-example.c`](https://github.com/Freescale/libimxvpuapi/blob/0.10.3/example/decode-example.c)
di `libimxvpuapi` (stessa licenza LGPL 2.1+). Legge H.264 Annex-B da stdin,
decodifica con l'hardware VPU vero, converte da I420 a BGRA (con tabelle
precalcolate — niente moltiplicazioni per pixel, il vero collo di bottiglia
prima dell'ottimizzazione), e scrive il risultato scalato direttamente nel
rettangolo scelto del framebuffer — lasciando intatto tutto il resto dello
schermo.

Compilato:

- **Dinamicamente**, collegato a `libimxvpuapi.so.0` e `libvpu.so.4` **già
  presenti sul citofono** (versione `0.10.3` esatta — le abbiamo scaricate
  direttamente dal dispositivo per collegarci contro la versione giusta,
  vedi sotto).
- Contro un **sysroot Ubuntu 18.04 "Bionic" (glibc 2.27)**, non quello di
  sistema: il citofono ha `glibc 2.27` al massimo (verificato con
  `strings /lib/libc.so.6 | grep GLIBC_`), mentre il nostro compilatore di
  bordo usa una `glibc` molto più recente. Compilare senza questo
  accorgimento produce un binario che chiede simboli (`GLIBC_2.34`) che il
  citofono non ha, e si rifiuta di partire.

## Come ricompilarli (riassunto)

Serve un cross-compilatore `arm-linux-gnueabihf-gcc` (pacchetto Ubuntu
`gcc-arm-linux-gnueabihf` + `libc6-dev-armhf-cross`), più:

1. **Un sysroot Bionic (glibc 2.27)**, per `vpu-fb-decode` soltanto:
   ```bash
   echo "deb [trusted=yes] http://archive.ubuntu.com/ubuntu bionic main universe" > /tmp/bionic.list
   apt-get -o Dir::Etc::sourcelist=/tmp/bionic.list -o Dir::Etc::sourceparts=/dev/null \
     -o Dir::State::Lists=/tmp/bionic-lists update
   apt-get -o Dir::Etc::sourcelist=/tmp/bionic.list -o Dir::Etc::sourceparts=/dev/null \
     -o Dir::State::Lists=/tmp/bionic-lists -o Dir::Cache::Archives=/tmp/bionic-archives \
     download "libc6-dev-armhf-cross=2.27-3ubuntu1cross1" "libc6-armhf-cross=2.27-3ubuntu1cross1"
   mkdir -p /tmp/bionic-sysroot && cd /tmp/bionic-sysroot
   dpkg-deb -x /tmp/*.deb .
   ```

2. **`libimxvpuapi.so.0`/`libvpu.so.4` prese dal citofono stesso** (scaricale
   via SSH/SCP da `/usr/lib/`), e l'header
   [`imxvpuapi.h`](https://github.com/Freescale/libimxvpuapi/blob/0.10.3/imxvpuapi/imxvpuapi.h)
   della **stessa versione** (verifica con
   `strings /usr/lib/libimxvpuapi.so.0.* | grep -i version` o dal nome del
   file `.so.0.X.Y` sul dispositivo).

3. **Compilazione di `vpu-fb-decode`**:
   ```bash
   arm-linux-gnueabihf-gcc -O2 -o vpu-fb-decode-armhf vpu-fb-decode.c h264_utils.c \
     -I/tmp/bionic-sysroot/usr/arm-linux-gnueabihf/include -I. \
     --sysroot=/tmp/bionic-sysroot -B/tmp/bionic-sysroot/usr/arm-linux-gnueabihf/lib \
     -L<cartella con le .so prese dal citofono> \
     -Wl,-rpath-link,<stessa cartella>:/tmp/bionic-sysroot/usr/arm-linux-gnueabihf/lib \
     -Wl,--allow-shlib-undefined \
     -l:libimxvpuapi.so.0 -l:libvpu.so.4 -lpthread
   arm-linux-gnueabihf-strip vpu-fb-decode-armhf
   ```
   (`--allow-shlib-undefined` serve perché alcuni simboli `GLIBC_PRIVATE` di
   `libpthread` si risolvono solo a runtime, non in fase di collegamento —
   normale per questo genere di build incrociata.)

4. **Compilazione di `ffmpeg-armhf`** — richiede prima `musl` (compilato con
   lo stesso `arm-linux-gnueabihf-gcc` come base) e `OpenSSL` (compilato con
   `musl-gcc`), poi `ffmpeg` stesso con `--cc=musl-gcc` e i flag
   `--disable-everything --enable-decoder=... --enable-demuxer=...` visti
   sopra. Vedi la cronologia degli strumenti usati per i comandi esatti se
   servono — il punto centrale da ricordare è **musl per `ffmpeg`** (deve
   fare rete/DNS) e **glibc-Bionic per `vpu-fb-decode`** (non fa rete, ma
   deve collegarsi a librerie di sistema che sono glibc).

## Verifica prima di distribuire un nuovo binario

```bash
file <binario>                                    # deve dire "statically linked" per ffmpeg-armhf
arm-linux-gnueabihf-objdump -T <binario> | grep -oE "GLIBC_[0-9.]+" | sort -V -u
# per vpu-fb-decode-armhf, l'ultima riga NON deve superare la versione
# massima di glibc del citofono (oggi: 2.27)
```
