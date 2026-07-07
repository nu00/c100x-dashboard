#!/usr/bin/env node
/*
 * fb-vnc.js — server VNC (RFB 3.3) minimale, SOLO VISUALIZZAZIONE, che
 * rispecchia il display reale del citofono leggendo direttamente da
 * /dev/fb1 all'offset corrente (framebuffer lineare a triplo buffering,
 * confermato funzionante via test manuale pan/offset).
 *
 * View-only: i messaggi di tastiera/mouse/clipboard dal client vengono letti
 * (per restare sincronizzati sullo stream TCP) ma SCARTATI, mai applicati.
 *
 * NESSUNA AUTENTICAZIONE (RFB security type "None") — pensato per uso solo
 * in LAN. Non esporre questa porta su internet.
 *
 * Uso: node fb-vnc.js [porta] [/dev/fbN] [updateHz]
 * Default: porta 5900, /dev/fb1, 3 aggiornamenti/secondo
 */

const net = require("net");
const fs = require("fs");

process.on("uncaughtException", (e) => console.error("[fb-vnc] uncaughtException:", e));
process.on("unhandledRejection", (e) => console.error("[fb-vnc] unhandledRejection:", e));

const PORT = parseInt(process.argv[2] || "5900", 10);
const FB_DEV = process.argv[3] || "/dev/fb1";
const UPDATE_HZ = parseFloat(process.argv[4] || "5");
const UPDATE_INTERVAL_MS = Math.round(1000 / UPDATE_HZ);

const WIDTH = 800;
const HEIGHT = 480;
const BYTES_PER_PIXEL = 4;
const BYTES_PER_LINE = WIDTH * BYTES_PER_PIXEL;
const FRAME_BYTES = WIDTH * HEIGHT * BYTES_PER_PIXEL;

const FB_SYS_BASE = "/sys/class/graphics/" + FB_DEV.split("/").pop();

let fbFd = null;
function openFb() {
    try {
        fbFd = fs.openSync(FB_DEV, "r");
        console.log(`[fb-vnc] ${FB_DEV} aperto (fd=${fbFd})`);
    } catch (e) {
        console.error(`[fb-vnc] impossibile aprire ${FB_DEV}:`, e.message);
        fbFd = null;
    }
}
openFb();

// Lettura ASINCRONA: fs.readSync bloccava l'intero processo (single-thread)
// per la durata della lettura, che su questo hardware puo' essere lenta e
// imprevedibile per contesa con la GUI che scrive sullo stesso framebuffer —
// causava lag di decine di secondi e istabilita'. fs.read/fs.readFile usano
// il thread-pool di libuv, quindi il resto del processo (invio dati ai
// client, gestione socket) continua a girare anche durante una lettura lenta.
function readFrameAsync(cb) {
    if (fbFd === null) {
        openFb();
        if (fbFd === null) return cb(null);
    }
    fs.readFile(FB_SYS_BASE + "/pan", "utf8", (errPan, raw) => {
        let panLines = 0;
        if (!errPan) {
            const y = parseInt((raw || "").trim().split(",")[1], 10);
            if (Number.isFinite(y)) panLines = y;
        }
        const offset = panLines * BYTES_PER_LINE;
        const buf = Buffer.allocUnsafe(FRAME_BYTES);
        fs.read(fbFd, buf, 0, FRAME_BYTES, offset, (errRead, bytesRead) => {
            if (errRead) {
                console.error("[fb-vnc] errore lettura framebuffer:", errRead.message);
                try { fs.close(fbFd, () => {}); } catch (_) { /* noop */ }
                fbFd = null;
                return cb(null);
            }
            if (bytesRead < FRAME_BYTES) buf.fill(0, bytesRead);
            cb(buf);
        });
    });
}

// Pixel format di default (quello dichiarato in ServerInit): i byte in
// memoria sono B,G,R,A. Letti come intero little-endian danno
// blue-shift=0, green-shift=8, red-shift=16.
const DEFAULT_FMT = {
    bpp: 32, depth: 24, bigEndian: false, trueColor: true,
    redMax: 255, greenMax: 255, blueMax: 255,
    redShift: 16, greenShift: 8, blueShift: 0
};

function buildPixelFormat(fmt) {
    const pf = Buffer.alloc(16);
    pf[0] = fmt.bpp;
    pf[1] = fmt.depth;
    pf[2] = fmt.bigEndian ? 1 : 0;
    pf[3] = fmt.trueColor ? 1 : 0;
    pf.writeUInt16BE(fmt.redMax, 4);
    pf.writeUInt16BE(fmt.greenMax, 6);
    pf.writeUInt16BE(fmt.blueMax, 8);
    pf[10] = fmt.redShift;
    pf[11] = fmt.greenShift;
    pf[12] = fmt.blueShift;
    return pf;
}

function parsePixelFormat(buf) {
    return {
        bpp: buf[0],
        depth: buf[1],
        bigEndian: buf[2] !== 0,
        trueColor: buf[3] !== 0,
        redMax: buf.readUInt16BE(4),
        greenMax: buf.readUInt16BE(6),
        blueMax: buf.readUInt16BE(8),
        redShift: buf[10],
        greenShift: buf[11],
        blueShift: buf[12]
    };
}

function sameFormat(a, b) {
    return a.bpp === b.bpp && a.bigEndian === b.bigEndian && a.trueColor === b.trueColor &&
        a.redMax === b.redMax && a.greenMax === b.greenMax && a.blueMax === b.blueMax &&
        a.redShift === b.redShift && a.greenShift === b.greenShift && a.blueShift === b.blueShift;
}

// Converte il frame sorgente (BGRA 32bpp, cosi' come letto dal framebuffer)
// nel pixel format richiesto dal client via SetPixelFormat. Se il client
// non lo chiede mai (caso comune), resta sul formato di default e questa
// funzione non viene nemmeno chiamata (vedi fast-path nel loop di invio).
function convertFrame(srcBgra, fmt) {
    const bytesPerPixel = Math.max(1, Math.round(fmt.bpp / 8));
    const out = Buffer.alloc(WIDTH * HEIGHT * bytesPerPixel);
    let outOff = 0;
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
        const srcOff = i * 4;
        const b = srcBgra[srcOff];
        const g = srcBgra[srcOff + 1];
        const r = srcBgra[srcOff + 2];
        const rv = fmt.redMax ? Math.round((r / 255) * fmt.redMax) : 0;
        const gv = fmt.greenMax ? Math.round((g / 255) * fmt.greenMax) : 0;
        const bv = fmt.blueMax ? Math.round((b / 255) * fmt.blueMax) : 0;
        const value = ((rv << fmt.redShift) | (gv << fmt.greenShift) | (bv << fmt.blueShift)) >>> 0;
        if (bytesPerPixel === 4) {
            if (fmt.bigEndian) out.writeUInt32BE(value >>> 0, outOff); else out.writeUInt32LE(value >>> 0, outOff);
        } else if (bytesPerPixel === 2) {
            if (fmt.bigEndian) out.writeUInt16BE(value & 0xffff, outOff); else out.writeUInt16LE(value & 0xffff, outOff);
        } else {
            out.writeUInt8(value & 0xff, outOff);
        }
        outOff += bytesPerPixel;
    }
    return out;
}

const clients = new Set();

const server = net.createServer((socket) => {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[fb-vnc] client connesso: ${addr}`);
    socket.setNoDelay(true);

    let stage = "version";
    let buf = Buffer.alloc(0);
    let pendingUpdate = false;
    let clientFmt = { ...DEFAULT_FMT };

    function append(chunk) {
        buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    }
    function consume(n) {
        const out = buf.subarray(0, n);
        buf = buf.subarray(n);
        return out;
    }

    function sendServerInit() {
        const name = Buffer.from("Citofono", "utf8");
        const head = Buffer.alloc(4 + 16 + 4);
        head.writeUInt16BE(WIDTH, 0);
        head.writeUInt16BE(HEIGHT, 2);
        buildPixelFormat(DEFAULT_FMT).copy(head, 4);
        head.writeUInt32BE(name.length, 20);
        socket.write(Buffer.concat([head, name]));
    }

    // Il SERVER parla per primo: la versione RFB va mandata subito alla
    // connessione, non dopo aver ricevuto qualcosa dal client (altrimenti
    // client e server restano entrambi in attesa l'uno dell'altro).
    socket.write(Buffer.from("RFB 003.008\n"));

    socket.on("data", (chunk) => {
        append(chunk);
        processBuffer();
    });

    function processBuffer() {
        for (;;) {
            if (stage === "version") {
                if (buf.length < 12) return;
                consume(12); // ignoriamo la versione dichiarata dal client
                // RFB 3.8: lista dei security-type offerti (solo "None" = 1)
                socket.write(Buffer.from([1, 1]));
                stage = "securityChoice";
                continue;
            }
            if (stage === "securityChoice") {
                if (buf.length < 1) return;
                consume(1); // il client sceglie tra quelli offerti (solo 1 disponibile)
                // RFB 3.8 richiede il SecurityResult anche per "None": 0 = OK
                socket.write(Buffer.alloc(4));
                stage = "clientInit";
                continue;
            }
            if (stage === "clientInit") {
                if (buf.length < 1) return;
                consume(1); // shared-flag, ignorato
                sendServerInit();
                stage = "running";
                continue;
            }
            if (buf.length < 1) return;
            const msgType = buf[0];
            if (msgType === 0) { // SetPixelFormat
                if (buf.length < 20) return;
                const msg = consume(20);
                clientFmt = parsePixelFormat(msg.subarray(4, 20));
                console.log(`[fb-vnc] ${addr} ha richiesto pixel format:`, clientFmt);
                continue;
            }
            if (msgType === 2) { // SetEncodings
                if (buf.length < 4) return;
                const n = buf.readUInt16BE(2);
                const total = 4 + n * 4;
                if (buf.length < total) return;
                consume(total);
                continue;
            }
            if (msgType === 3) { // FramebufferUpdateRequest
                if (buf.length < 10) return;
                consume(10);
                pendingUpdate = true;
                continue;
            }
            if (msgType === 4) { // KeyEvent - ignorato (view-only)
                if (buf.length < 8) return;
                consume(8);
                continue;
            }
            if (msgType === 5) { // PointerEvent - ignorato (view-only)
                if (buf.length < 6) return;
                consume(6);
                continue;
            }
            if (msgType === 6) { // ClientCutText
                if (buf.length < 8) return;
                const len = buf.readUInt32BE(4);
                const total = 8 + len;
                if (buf.length < total) return;
                consume(total);
                continue;
            }
            console.warn(`[fb-vnc] messaggio sconosciuto (tipo ${msgType}) da ${addr}, chiudo`);
            socket.destroy();
            return;
        }
    }

    const clientObj = {
        socket,
        get pending() { return pendingUpdate; },
        get fmt() { return clientFmt; },
        consumePending() { pendingUpdate = false; },
        isRunning() { return stage === "running"; }
    };
    clients.add(clientObj);

    socket.on("close", () => {
        clients.delete(clientObj);
        console.log(`[fb-vnc] client disconnesso: ${addr}`);
    });
    socket.on("error", (e) => {
        console.warn(`[fb-vnc] errore socket ${addr}:`, e.message);
    });
});

server.on("error", (e) => {
    console.error("[fb-vnc] errore server:", e.message);
    process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[fb-vnc] VNC view-only in ascolto su porta ${PORT}, sorgente ${FB_DEV}, ~${UPDATE_HZ} fps`);
});

let tickInFlight = false; // evita letture sovrapposte se la precedente e' ancora in corso

setInterval(() => {
    if (tickInFlight) return;

    let anyPending = false;
    for (const c of clients) {
        if (c.isRunning() && c.pending) { anyPending = true; break; }
    }
    if (!anyPending) return;

    tickInFlight = true;
    readFrameAsync((frame) => {
        tickInFlight = false;
        if (!frame) return;

        for (const c of clients) {
            if (!c.isRunning() || !c.pending) continue;

            const pixels = sameFormat(c.fmt, DEFAULT_FMT) ? frame : convertFrame(frame, c.fmt);

            const rectHeader = Buffer.alloc(12);
            rectHeader.writeUInt16BE(0, 0);
            rectHeader.writeUInt16BE(0, 2);
            rectHeader.writeUInt16BE(WIDTH, 4);
            rectHeader.writeUInt16BE(HEIGHT, 6);
            rectHeader.writeInt32BE(0, 8); // encoding 0 = Raw

            const msgHeader = Buffer.alloc(4);
            msgHeader[0] = 0; // FramebufferUpdate
            msgHeader.writeUInt16BE(1, 2); // 1 rettangolo

            const packet = Buffer.concat([msgHeader, rectHeader, pixels]);

            try {
                c.socket.write(packet);
                c.consumePending();
            } catch (e) {
                console.warn("[fb-vnc] errore invio a client:", e.message);
            }
        }
    });
}, UPDATE_INTERVAL_MS);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
