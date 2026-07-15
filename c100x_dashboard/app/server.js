/*
 * C100X Dashboard - server (v0.4.0)
 *
 * Novita' v0.4.0:
 *  - Ingress (interfaccia integrata nella barra laterale di HA)
 *  - Upload immagini (/api/images, /image/:name) e immagini gia' presenti in HA (/api/ha-images, /ha-image/:name)
 *  - Icone assegnate alle entita' (/api/entity-icons), in aggiunta a tutte le MDI
 *  - Gli elementi possono avere rotazione, e ci sono linee/frecce (gestiti lato editor/citofono)
 */

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = 8099;
const VERSION = "0.13.0";
// Versione del renderer lato citofono (SchedaPage.qml + blocco watcher).
// Bumpare SOLO quando cambiano quei file, cosi\' l\'add-on sa se il citofono e\' da aggiornare.
const RENDERER_VERSION = "19";

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const HA_API = "http://supervisor/core/api";

const DATA = "/data";
const LAYOUTS_DIR = path.join(DATA, "layouts");
const IMAGES_DIR = path.join(DATA, "images");
const ACTIVE_FILE = path.join(DATA, "active.json");

fs.mkdirSync(LAYOUTS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Cartella www di Home Assistant (montata in sola lettura), se disponibile
let WWW_DIR = null;
for (const p of ["/homeassistant/www", "/config/www"]) {
    try { if (fs.statSync(p).isDirectory()) { WWW_DIR = p; break; } } catch {}
}
console.log("[c100x-dashboard] www HA:", WWW_DIR || "non disponibile");

// Set icone MDI
let mdiMeta = [], MDI_SVG_DIR = null;
try {
    mdiMeta = require("@mdi/svg/meta.json");
    MDI_SVG_DIR = path.join(path.dirname(require.resolve("@mdi/svg/meta.json")), "svg");
    console.log(`[c100x-dashboard] icone MDI: ${mdiMeta.length}`);
} catch (e) { console.warn("[c100x-dashboard] @mdi/svg non disponibile:", e.message); }

// Set dei nomi MDI realmente disponibili: serve a validare le icone calcolate
// (batteria/cover/…) così un nome inesistente non lascia un buco sul citofono.
const MDI_NAMES = mdiMeta.length ? new Set(mdiMeta.map(m => m.name)) : null;

// Risoluzione stato tradotto + icona "come Lovelace"
const { iconForEntity, colorForEntity, buildTemplate, formatDate } = require("./entity-render.js");

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

app.use(express.json({ limit: "16mb" }));
app.use(express.static(path.join(__dirname, "static"), {
    setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.setHeader("Cache-Control", "no-cache"); }
}));
// no-cache su TUTTE le richieste /image (anche i 404), così un file mancante
// subito dopo un reimport non resta "incollato" come 404 nella cache del browser.
app.use("/image", (req, res, next) => { res.setHeader("Cache-Control", "no-cache"); next(); });
app.use("/image", express.static(IMAGES_DIR, {
    // Le immagini possono essere ricaricate/sostituite: rivalidazione ad ogni richiesta.
    etag: true
}));
if (WWW_DIR) app.use("/ha-image", express.static(WWW_DIR));

function safeName(name) { return typeof name === "string" && /^[A-Za-z0-9 _-]{1,40}$/.test(name); }
function safeFile(name) { return typeof name === "string" && /^[A-Za-z0-9._ -]{1,80}$/.test(name) && !name.includes(".."); }
function layoutPath(name) { return path.join(LAYOUTS_DIR, name + ".json"); }

// --- Stati entita' ---
async function getState(entity) {
    if (!SUPERVISOR_TOKEN) throw new Error("SUPERVISOR_TOKEN mancante");
    const r = await fetch(`${HA_API}/states/${encodeURIComponent(entity)}`, { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } });
    if (!r.ok) throw new Error("HA " + r.status);
    return r.json();
}

// Costruisce l'URL di camera_proxy_stream con il token VERO dell'entita' (il
// suo attributo "access_token", che HA ruota periodicamente) — lo stesso
// meccanismo che usa il frontend di Lovelace per davvero (verificato negli
// strumenti sviluppatore del browser: il video passa da qui, autenticato con
// un token in query string, non un header).
//
// IMPORTANTE: usiamo l'indirizzo LAN diretto di HA (c.haUrl), NON il proxy
// interno del supervisor — verificato nel codice sorgente di HA
// (homeassistant/components/camera/__init__.py, classe CameraView): questa
// vista specifica accetta "request[KEY_AUTHENTICATED] OR token in
// camera.access_tokens", ma il proxy del supervisor inietta SEMPRE un suo
// header Authorization in ogni richiesta che ci passa attraverso — se quello
// non basta da solo per l'autenticazione standard, la vista risponde 401
// invece di 403 (vedi codice: "if hdrs.AUTHORIZATION in request.headers:
// raise HTTPUnauthorized"). Il nostro token in query non ha mai la
// possibilita' di essere controllato. Andando all'indirizzo diretto,
// nessun header Authorization viene aggiunto per conto nostro, esattamente
// come fa il browser dell'utente (verificato: funziona).
async function getCameraProxyStreamUrl(entity) {
    const c = await readCfg();
    if (!c.haUrl) throw new Error("URL di Home Assistant non configurato (vedi impostazioni citofono) — serve l'indirizzo diretto, il proxy del supervisor non funziona per questo endpoint specifico");
    const state = await getState(entity);
    const token = state && state.attributes && state.attributes.access_token;
    if (!token) throw new Error("l'entita' non ha un access_token (non sembra una vera entita' camera)");
    return `${c.haUrl}/api/camera_proxy_stream/${encodeURIComponent(entity)}?token=${encodeURIComponent(token)}`;
}
async function getAllStates() {
    if (!SUPERVISOR_TOKEN) return [];
    const r = await fetch(`${HA_API}/states`, { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } });
    if (!r.ok) throw new Error("HA " + r.status);
    return r.json();
}

// Rende in UN colpo (un solo /api/template) stato tradotto + unita' + attributi icona
// per tutte le entita' passate. Ritorna { entityId: { s, t, u, dc, ic, bl, ch } } o {}.
async function fetchEntityData(ids, attrsById) {
    if (!SUPERVISOR_TOKEN || !ids.length) return {};
    const r = await fetch(`${HA_API}/template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ template: buildTemplate(ids, attrsById) })
    });
    if (!r.ok) throw new Error("HA template " + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return {}; }
}

// Renderizza un template Jinja2 arbitrario tramite HA (come una card markdown di Lovelace).
// Ritorna la stringa risultante, o un messaggio d'errore leggibile.
async function renderTemplate(code) {
    if (!SUPERVISOR_TOKEN) return "";
    if (!code || !String(code).trim()) return "";
    const r = await fetch(`${HA_API}/template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ template: String(code) })
    });
    const txt = await r.text();
    if (!r.ok) {
        // HA restituisce il messaggio d'errore del template nel corpo: lo passiamo (troncato).
        return "⚠ " + txt.slice(0, 120);
    }
    return txt;
}

// NOTA STORICA: qui vivevano due tentativi precedenti abbandonati:
// 1) HLS/stream component di HA via WebSocket (camera/stream) — funzionava,
//    ma richiedeva gestire il rinnovo di sessioni che scadono.
// 2) camera_proxy_stream con header "Authorization: Bearer" — sembrava non
//    dare mai dati (si scopri' poi che l'endpoint vuole il token in query
//    string, non un header: la connessione di rete funzionava gia' bene).
// La soluzione buona, sotto (getCameraProxyStreamUrl), usa camera_proxy_stream
// con il token VERO letto dall'attributo "access_token" dell'entita' — lo
// stesso meccanismo confermato nel browser (strumenti sviluppatore) per il
// frontend di Lovelace.


// Con la vecchia pipeline GStreamer, fMP4/LL-HLS non era leggibile (mancava
// qtdemux). Con la nuova pipeline (ffmpeg-armhf + vpu-fb-decode sul citofono)
// il contenitore non conta piu' — ffmpeg legge fMP4 e MPEG-TS indifferentemente.
// L'unico vincolo reale ora e' il CODEC: il nostro decoder VPU sa fare solo
// H.264. Interroghiamo la sorgente con ffmpeg stesso (gia' installato
// sull'add-on per il relay) invece di analizzare a mano il testo della
// playlist — piu' affidabile, funziona con qualunque formato ffmpeg capisca.
function probeCodec(url) {
    return new Promise((resolve) => {
        const child = spawn("ffmpeg", ["-i", url, "-t", "1", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        const timeout = setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) { /* ignore */ } }, 20000);
        child.on("close", () => {
            clearTimeout(timeout);
            console.log(`[c100x-dashboard] CAMERA probe codec (${url}):\n${stderr.slice(0, 2000)}`);
            const m = stderr.match(/Video:\s*([a-z0-9_]+)/i);
            resolve({ codec: m ? m[1].toLowerCase() : null, raw: stderr });
        });
        child.on("error", (e) => { clearTimeout(timeout); resolve({ codec: null, raw: String(e) }); });
    });
}

async function checkCameraCompatibility(url) {
    const p = await probeCodec(url);
    if (!p.codec) {
        return { ok: false, error: "impossibile determinare il codec della sorgente (non raggiungibile o formato sconosciuto)" };
    }
    if (p.codec === "h264") {
        return { ok: true, codec: "h264" };
    }
    // Non H.264: serve una ricodifica (il nostro relay ffmpeg->libx264 la fa
    // gia' in automatico per l'entita' HA) — non e' un errore bloccante,
    // solo un'informazione per l'utente.
    return { ok: true, codec: p.codec, needsTranscode: true,
        warning: `Questa sorgente usa il codec "${p.codec}" (non H.264) — verra' ricodificata automaticamente in H.264 dall'add-on prima di essere mostrata sul citofono. Nessuna azione necessaria da parte tua.` };
}

// Applica un colore condizionale a un elemento, valutando un template Jinja2 che puo':
//  - ritornare un colore diretto ("#ff0000" / "red") -> usato come colore;
//  - ritornare true/false (on/off/1/0) -> usa el.colorTrue / el.colorFalse.
// Modifica el.color in-place. In caso d'errore lascia il colore invariato.
async function applyConditionalColor(el) {
    if (!el.colorTemplate || !String(el.colorTemplate).trim()) return;
    try {
        const cres = (await renderTemplate(el.colorTemplate)).trim();
        const low = cres.toLowerCase();
        if (low === "true" || low === "on" || low === "1") {
            if (el.colorTrue) el.color = el.colorTrue;
        } else if (low === "false" || low === "off" || low === "0" || low === "none" || low === "") {
            if (el.colorFalse) el.color = el.colorFalse;
        } else if (cres) {
            el.color = cres;
        }
    } catch (e) { /* lascia il colore statico */ }
}

// Conversione markdown base -> HTML reso da Qt RichText (Text.RichText su Qt 5.10).
// Supporta: **grassetto**, *corsivo*, `code`, righe (a capo), # titoli, - liste.
function markdownToHtml(md) {
    if (md == null) return "";
    let s = String(md);
    // escape HTML di base per non rompere il RichText
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // codice inline `...`
    s = s.replace(/`([^`]+)`/g, '<font face="monospace">$1</font>');
    // grassetto **...** e __...__
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<b>$1</b>");
    // corsivo *...* e _..._
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>").replace(/(^|[^_])_([^_]+)_/g, "$1<i>$2</i>");
    // titoli # / ## / ### (a inizio riga)
    s = s.replace(/^###\s+(.+)$/gm, '<b><font size="4">$1</font></b>')
         .replace(/^##\s+(.+)$/gm, '<b><font size="5">$1</font></b>')
         .replace(/^#\s+(.+)$/gm, '<b><font size="6">$1</font></b>');
    // liste "- " / "* " a inizio riga -> bullet
    s = s.replace(/^\s*[-*]\s+(.+)$/gm, "• $1");
    // a capo -> <br>
    s = s.replace(/\r?\n/g, "<br>");
    return s;
}

app.get("/api/state/:entity", async (req, res) => {
    try {
        const id = req.params.entity;
        const raw = await getState(id);
        // Prova ad aggiungere lo stato tradotto (come lo vedra' il citofono); se fallisce, resta il grezzo.
        let translated = raw.state, unit = (raw.attributes && raw.attributes.unit_of_measurement) || null;
        try {
            const d = (await fetchEntityData([id]))[id];
            if (d) { if (d.t !== undefined && d.t !== null) translated = d.t; if (d.u) unit = d.u; }
        } catch {}
        // Elenco attributi disponibili (per la tendina "attributo" nell'editor).
        const attributes = raw.attributes || {};
        const attributeNames = Object.keys(attributes);
        res.json({ ...raw, translated, unit, attributeNames });
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

app.get("/api/entities", async (req, res) => {
    try {
        const states = await getAllStates();
        res.json(states.map(s => ({ id: s.entity_id, name: (s.attributes && s.attributes.friendly_name) || s.entity_id })));
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

// Anteprima di un template Jinja2 per l'editor: ritorna testo grezzo e HTML markdown.
app.post("/api/template-preview", async (req, res) => {
    try {
        const code = (req.body && req.body.template) || "";
        const raw = await renderTemplate(code);
        const out = { raw, html: markdownToHtml(raw) };
        // colore condizionale opzionale
        const colorCode = req.body && req.body.colorTemplate;
        if (colorCode && String(colorCode).trim()) {
            try {
                const cres = (await renderTemplate(colorCode)).trim();
                out.colorResult = cres;
            } catch (e) { out.colorResult = null; }
        }
        res.json(out);
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

// Verifica una sorgente camera. Per URL diretto: controlla il codec (quel
// percorso usa la decodifica hardware H.264, serve H.264 nativo). Per
// entita' HA: basta confermare che risponda — la modalita' mjpeg (quella
// usata per le entita') funziona con qualunque codec nativo della
// telecamera, dato che camera_proxy_stream la normalizza sempre in MJPEG.
app.post("/api/camera-check", async (req, res) => {
    const b = req.body || {};
    try {
        if (b.sourceType === "url") {
            const streamUrl = (b.url || "").trim();
            if (!streamUrl) return res.json({ ok: false, error: "URL vuoto" });
            const check = await checkCameraCompatibility(streamUrl);
            return res.json({ ...check, streamUrl });
        }
        if (!b.entity) return res.json({ ok: false, error: "entita' non specificata" });
        const streamUrl = await getCameraProxyStreamUrl(b.entity);
        const p = await probeCodec(streamUrl);
        if (!p.codec) return res.json({ ok: false, error: "impossibile raggiungere la sorgente" });
        res.json({ ok: true, codec: p.codec, streamUrl });
    } catch (e) {
        res.json({ ok: false, error: String(e.message || e) });
    }
});

// Icone assegnate alle entita' (solo mdi:, perche' poi le serviamo al citofono)
app.get("/api/entity-icons", async (req, res) => {
    try {
        const states = await getAllStates();
        const set = new Set();
        for (const s of states) {
            const ic = s.attributes && s.attributes.icon;
            if (typeof ic === "string" && ic.startsWith("mdi:")) set.add(ic.slice(4));
        }
        res.json([...set].sort());
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

// Chiama un servizio HA (domain.service) con il payload dato (target + data uniti).
async function callService(domain, service, payload) {
    if (!SUPERVISOR_TOKEN) throw new Error("no supervisor token");
    const r = await fetch(`${HA_API}/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
    });
    if (!r.ok) throw new Error("HA service " + r.status + " " + (await r.text().catch(() => "")));
    return r.json().catch(() => ([]));
}

// Elenco servizi HA (per il configuratore azioni nell'editor, stile Strumenti Sviluppo)
app.get("/api/services", async (req, res) => {
    try {
        if (!SUPERVISOR_TOKEN) return res.json([]);
        const r = await fetch(`${HA_API}/services`, { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } });
        if (!r.ok) throw new Error("HA " + r.status);
        res.json(await r.json());
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

// Esegue l'azione associata a un tasto della scheda attiva (chiamato dalla SchedaPage).
app.post("/api/action", async (req, res) => {
    try {
        const { scheda, button } = req.body || {};
        if (!scheda || !button) return res.status(400).json({ error: "scheda e button richiesti" });
        let layout;
        try { layout = JSON.parse(await fsp.readFile(layoutPath(scheda), "utf8")); }
        catch { return res.status(404).json({ error: "scheda non trovata" }); }
        const cfg = layout.buttons && layout.buttons[button];
        if (!cfg || !cfg.action) return res.json({ ok: true, noop: true });
        const a = cfg.action; // { domain, service, data, target }
        if (!a.domain || !a.service) return res.status(400).json({ error: "azione incompleta" });
        const payload = Object.assign({}, a.data || {});
        // I valori del "data" possono contenere Jinja2 (es. "{{ state_attr(...) + 1 }}").
        // L'API REST di HA NON valuta Jinja nel body, quindi li renderizziamo qui e
        // convertiamo il risultato al tipo appropriato (numero/bool/stringa).
        for (const k of Object.keys(payload)) {
            let v = payload[k];
            if (typeof v === "string") {
                // Robustezza: alcune azioni salvate da versioni precedenti hanno il valore
                // con le virgolette YAML incluse nella stringa (es. "\"{{ ... }}\"").
                // Le rimuoviamo qui prima di valutare, cosi' i template vecchi funzionano.
                const trimmed = v.trim();
                if (trimmed.length >= 2 && ((trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') || (trimmed[0] === "'" && trimmed[trimmed.length - 1] === "'"))) {
                    v = trimmed.slice(1, -1);
                    payload[k] = v;
                }
            }
            if (typeof v === "string" && /\{\{|\{%/.test(v)) {
                try {
                    let r = (await renderTemplate(v)).trim();
                    if (/^-?\d+(\.\d+)?$/.test(r)) payload[k] = parseFloat(r);
                    else if (r.toLowerCase() === "true") payload[k] = true;
                    else if (r.toLowerCase() === "false") payload[k] = false;
                    else payload[k] = r;
                } catch (e) { /* lascia il valore originale in caso d'errore */ }
            }
        }
        // L'endpoint REST /api/services/<dominio>/<servizio> vuole entity_id/area_id/device_id
        // direttamente nel body, NON annidati in "target" (che e' formato websocket/YAML).
        // Appiattiamo quindi target nel payload per evitare il 400 Bad Request.
        if (a.target && typeof a.target === "object") {
            if (a.target.entity_id !== undefined) payload.entity_id = a.target.entity_id;
            if (a.target.area_id !== undefined) payload.area_id = a.target.area_id;
            if (a.target.device_id !== undefined) payload.device_id = a.target.device_id;
        } else if (typeof a.target === "string" && a.target) {
            payload.entity_id = a.target;
        }
        await callService(a.domain, a.service, payload);
        res.json({ ok: true });
    } catch (e) { res.status(502).json({ ok: false, error: String(e) }); }
});

// Anteprima per l'editor: nome icona calcolato per un'entita' (stesso resolver del /active)
app.get("/api/entity-icon/:entity", async (req, res) => {
    try {
        const id = req.params.entity;
        const data = await fetchEntityData([id]);
        const name = iconForEntity(id, data[id], MDI_NAMES);
        const color = colorForEntity(id, data[id], null); // colore automatico per l'anteprima
        res.json({ icon: name || "help-circle-outline", color });
    } catch (e) { res.status(502).json({ error: String(e) }); }
});

// --- Icone MDI ---
app.get("/api/icons", (req, res) => {
    const q = String(req.query.q || "").toLowerCase().trim();
    if (!MDI_SVG_DIR || !q) return res.json([]);
    const out = [];
    for (const m of mdiMeta) {
        if (m.name.includes(q) || (m.aliases || []).some(a => a.includes(q))) { out.push({ name: m.name }); if (out.length >= 40) break; }
    }
    res.json(out);
});
app.get("/icon/:name", (req, res) => {
    if (!MDI_SVG_DIR) return res.status(404).end();
    const name = String(req.params.name).replace(/\.svg$/, "");
    if (!/^[a-z0-9-]+$/.test(name)) return res.status(400).end();
    try {
        let svg = fs.readFileSync(path.join(MDI_SVG_DIR, name + ".svg"), "utf8");
        const c = String(req.query.color || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        // Le SVG MDI hanno solo viewBox 24x24 (niente width/height): senza una dimensione
        // esplicita certi client (es. il QtSvg del citofono) le rasterizzano a 24px e poi le
        // ingrandiscono, risultando sfocate. Iniettiamo width/height alla dimensione richiesta.
        let s = parseInt(req.query.s, 10);
        if (!Number.isFinite(s)) s = 256;
        s = Math.max(16, Math.min(512, s));
        let attrs = `width="${s}" height="${s}"`;
        if (c.length === 6) attrs += ` fill="#${c}"`;
        svg = svg.replace(/<svg /, `<svg ${attrs} `);
        res.type("image/svg+xml").set("Cache-Control", "public, max-age=86400").send(svg);
    } catch { res.status(404).end(); }
});

// --- Immagini caricate ---
app.get("/api/images", async (req, res) => {
    const files = (await fsp.readdir(IMAGES_DIR).catch(() => [])).filter(f => IMG_EXT.test(f));
    res.json(files.sort().map(f => ({ name: f, url: "image/" + encodeURIComponent(f) })));
});
app.post("/api/images", async (req, res) => {
    const { name, data } = req.body || {};
    if (!safeFile(name)) return res.status(400).json({ error: "nome file non valido" });
    if (typeof data !== "string") return res.status(400).json({ error: "dati mancanti" });
    const m = data.match(/^data:image\/[\w.+-]+;base64,(.+)$/);
    if (!m) return res.status(400).json({ error: "formato dati non valido" });
    try {
        await fsp.writeFile(path.join(IMAGES_DIR, name), Buffer.from(m[1], "base64"));
        res.json({ ok: true, url: "image/" + encodeURIComponent(name) });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.delete("/api/images/:name", async (req, res) => {
    if (!safeFile(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    await fsp.unlink(path.join(IMAGES_DIR, req.params.name)).catch(() => {});
    res.json({ ok: true });
});

// --- Immagini gia' presenti in HA (cartella www) ---
app.get("/api/ha-images", async (req, res) => {
    if (!WWW_DIR) return res.json([]);
    const files = (await fsp.readdir(WWW_DIR).catch(() => [])).filter(f => IMG_EXT.test(f));
    res.json(files.sort().map(f => ({ name: f, url: "ha-image/" + encodeURIComponent(f) })));
});

// --- CRUD layout ---
app.get("/api/layouts", async (req, res) => {
    const files = await fsp.readdir(LAYOUTS_DIR).catch(() => []);
    res.json({ layouts: files.filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, "")).sort() });
});
// Export: tutte le schede in un unico file JSON (backup che sopravvive alla disinstallazione).
app.get("/api/export", async (req, res) => {
    try {
        const files = (await fsp.readdir(LAYOUTS_DIR).catch(() => [])).filter(f => f.endsWith(".json"));
        const layouts = {};
        for (const f of files) {
            const name = f.replace(/\.json$/, "");
            try { layouts[name] = JSON.parse(await fsp.readFile(path.join(LAYOUTS_DIR, f), "utf8")); } catch {}
        }
        // Incorpora anche le immagini caricate (come base64), così il backup è completo
        // e reinstallando l'add-on non si perde nulla.
        const images = {};
        const imgFiles = (await fsp.readdir(IMAGES_DIR).catch(() => [])).filter(f => IMG_EXT.test(f));
        for (const f of imgFiles) {
            try {
                const buf = await fsp.readFile(path.join(IMAGES_DIR, f));
                const ext = (f.split(".").pop() || "png").toLowerCase();
                const mime = ext === "svg" ? "image/svg+xml" : (ext === "jpg" ? "image/jpeg" : "image/" + ext);
                images[f] = "data:" + mime + ";base64," + buf.toString("base64");
            } catch {}
        }
        const dump = { app: "c100x-dashboard", version: 2, exportedAt: new Date().toISOString(), layouts, images };
        res.setHeader("Content-Disposition", 'attachment; filename="c100x-schede-backup.json"');
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(dump, null, 2));
    } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Import: ripristina schede (e immagini) da un backup. Query ?overwrite=1 per sovrascrivere.
app.post("/api/import", async (req, res) => {
    try {
        const body = req.body || {};
        const layouts = body.layouts || body; // accetta sia il dump completo sia il solo oggetto layouts
        if (!layouts || typeof layouts !== "object") return res.status(400).json({ error: "backup non valido" });
        const overwrite = req.query.overwrite === "1" || req.query.overwrite === "true";
        const existing = new Set((await fsp.readdir(LAYOUTS_DIR).catch(() => [])).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, "")));
        let imported = 0, skipped = 0;
        for (const [name, layout] of Object.entries(layouts)) {
            if (!safeName(name)) { skipped++; continue; }
            if (existing.has(name) && !overwrite) { skipped++; continue; }
            const clean = (layout && typeof layout === "object") ? layout : {};
            clean.name = name;
            await fsp.writeFile(layoutPath(name), JSON.stringify(clean, null, 2));
            imported++;
        }
        // Ripristina le immagini incorporate nel backup (versione 2+).
        let images = 0;
        if (body.images && typeof body.images === "object") {
            const existingImg = new Set(await fsp.readdir(IMAGES_DIR).catch(() => []));
            for (const [fname, dataUrl] of Object.entries(body.images)) {
                if (!safeFile(fname) || typeof dataUrl !== "string") continue;
                if (existingImg.has(fname) && !overwrite) continue;
                const m = dataUrl.match(/^data:image\/[\w.+-]+;base64,(.+)$/);
                if (!m) continue;
                try { await fsp.writeFile(path.join(IMAGES_DIR, fname), Buffer.from(m[1], "base64")); images++; } catch {}
            }
        }
        res.json({ ok: true, imported, skipped, images });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.get("/api/layouts/:name", async (req, res) => {
    if (!safeName(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    try { res.json(JSON.parse(await fsp.readFile(layoutPath(req.params.name), "utf8"))); }
    catch { res.status(404).json({ error: "layout non trovato" }); }
});
// Come sopra ma con gli elementi risolti allo stato ATTUALE (per le anteprime home).
app.get("/api/layout-live/:name", async (req, res) => {
    if (!safeName(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    try {
        const layout = JSON.parse(await fsp.readFile(layoutPath(req.params.name), "utf8"));
        const out = JSON.parse(JSON.stringify(layout));
        await resolveElementsLive(out);
        res.json(out);
    } catch (e) { res.status(404).json({ error: "layout non trovato" }); }
});
app.put("/api/layouts/:name", async (req, res) => {
    if (!safeName(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    const layout = req.body || {};
    layout.name = req.params.name;
    for (const el of layout.elements || []) for (const k of Object.keys(el)) if (k.startsWith("_")) delete el[k];
    try { await fsp.writeFile(layoutPath(req.params.name), JSON.stringify(layout, null, 2)); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: String(e) }); }
});
app.delete("/api/layouts/:name", async (req, res) => {
    if (!safeName(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    await fsp.unlink(layoutPath(req.params.name)).catch(() => {});
    res.json({ ok: true });
});

// --- Layout attivo + segnale di visualizzazione ---
async function readActive() {
    try { return JSON.parse(await fsp.readFile(ACTIVE_FILE, "utf8")); }
    catch { return { name: null, showSeq: 0, duration: 0 }; }
}
async function writeActive(o) { await fsp.writeFile(ACTIVE_FILE, JSON.stringify(o)); }

app.get("/api/active", async (req, res) => { res.json(await readActive()); });

app.post("/api/active", async (req, res) => {
    const name = req.body && req.body.name;
    if (name !== null && name !== undefined && !safeName(name)) return res.status(400).json({ error: "nome non valido" });
    const a = await readActive();
    a.name = (name === undefined ? a.name : name);
    await writeActive(a);
    res.json({ ok: true });
});

// Node-RED / editor: fa comparire la scheda sul citofono ora (opzionale: name + duration)
// --- Cosa e' davvero mostrato a schermo (riportato dal QML) ---
// "idle" = schermo libero/home (incluso quando l'utente chiude con la rotella
// laterale, o quando arriva una chiamata reale che porta via lo stack).
// Letto dall'integrazione HA via il coordinator veloce (vedi custom_components).
let lastSchedaShown = null;

app.post("/api/scheda-state", (req, res) => {
    const name = (req.body && typeof req.body.name === "string" && req.body.name.trim()) || null;
    const newState = name || "idle";
    const changed = newState !== lastSchedaShown;
    lastSchedaShown = newState;
    res.json({ ok: true, state: lastSchedaShown });

    // Se lo stato VERO (non la nostra richiesta) e' cambiato verso una scheda
    // senza telecamera (es. chiamata reale in arrivo, chiusura manuale con la
    // rotella laterale), ferma una pipeline eventualmente rimasta attiva —
    // altrimenti resterebbe orfana, dato che quell'evento non passa da
    // /api/hide. Solo quando cambia davvero, per non richiamare lo stop ad
    // ogni riporto ripetuto dello stesso stato.
    if (changed) {
        findCameraElements(newState).then((cams) => {
            if (!cams.length) stopCameraOnController().catch((e) => console.log("[c100x-dashboard] CAMERA stop errore:", e.message));
        }).catch(() => { /* se la scheda non esiste nemmeno, nessuna camera da fermare */ });
    }
});

app.get("/api/scheda-state", (req, res) => { res.json({ state: lastSchedaShown }); });

app.post("/api/show", async (req, res) => {
    const b = req.body || {};
    const a = await readActive();
    if (b.name) {
        if (!safeName(b.name)) return res.status(400).json({ error: "nome non valido" });
        a.name = b.name;
    }
    a.showSeq = Date.now();
    a.duration = Math.max(0, parseInt(b.duration || 0) || 0);
    await writeActive(a);
    res.json({ ok: true, showSeq: a.showSeq });

    // Camera: se la scheda mostrata ha un elemento camera, avvia la pipeline sul
    // controller. Se NON ce l'ha, ferma una pipeline eventualmente rimasta
    // attiva da una scheda precedente (passaggio diretto fra schede, senza un
    // "nascondi" esplicito in mezzo — altrimenti resterebbe orfana).
    // Best-effort: non blocca la risposta ne' fallisce lo show.
    findCameraElements(a.name).then((cams) => {
        if (cams.length) maybeStartCameraForLayout(a.name).catch((e) => console.log("[c100x-dashboard] CAMERA errore:", e.message));
        else stopCameraOnController().catch((e) => console.log("[c100x-dashboard] CAMERA stop errore:", e.message));
    }).catch((e) => console.log("[c100x-dashboard] CAMERA errore lettura scheda:", e.message));
});

// Nasconde la scheda (es. quando torna la corrente)
app.post("/api/hide", async (req, res) => {
    const a = await readActive();
    a.hideSeq = Date.now();
    await writeActive(a);
    res.json({ ok: true, hideSeq: a.hideSeq });

    // Ferma sempre la pipeline camera (no-op innocuo se non ne stava girando una).
    stopCameraOnController().catch((e) => console.log("[c100x-dashboard] CAMERA stop errore:", e.message));
});

async function findCameraElements(layoutName) {
    if (!layoutName || !safeName(layoutName)) return [];
    try {
        const raw = await fsp.readFile(layoutPath(layoutName), "utf8");
        const layout = JSON.parse(raw);
        return (layout.elements || []).filter((e) => e.type === "camera");
    } catch (e) { return []; }
}

// Il token dell'entita' (access_token) ruota ogni ~5 minuti lato HA — con la
// pipeline diretta (niente relay di mezzo) il citofono legge da HA per tutta
// la durata della visualizzazione, quindi serve rinfrescare periodicamente
// prima che scada, invece di aspettare che la pipeline si blocchi da sola.
// Una voce per ogni telecamera attiva (indicizzata per id elemento), non piu'
// un singolo timer globale — piu' telecamere possono essere attive insieme.
const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // sotto i 5 minuti di rotazione
const cameraRefreshTimers = new Map(); // id -> { timer, host, entity, x, y, w, h }

async function maybeStartCameraForLayout(layoutName) {
    console.log("[c100x-dashboard] CAMERA maybeStart per layout:", layoutName);
    const cams = await findCameraElements(layoutName);
    if (!cams.length) { console.log("[c100x-dashboard] CAMERA nessun elemento camera in questa scheda"); return; }
    console.log("[c100x-dashboard] CAMERA elementi trovati:", cams.length);
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) throw new Error("host del citofono non configurato");

    stopAllCameraRefreshTimers();

    // Ogni telecamera e' indipendente: un errore su una non deve bloccare le
    // altre — le avviamo tutte, raccogliendo eventuali errori separatamente.
    const results = await Promise.allSettled(cams.map((cam) => startOneCamera(cam, host)));
    results.forEach((r, i) => {
        if (r.status === "rejected") console.log(`[c100x-dashboard] CAMERA errore (${cams[i].id}):`, r.reason.message);
    });
}

async function startOneCamera(cam, host) {
    console.log("[c100x-dashboard] CAMERA elemento:", JSON.stringify(cam));
    let streamUrl, mode, insertAud;

    if (cam.sourceType === "url") {
        streamUrl = (cam.url || "").trim();
        if (!streamUrl) throw new Error("nessun URL impostato per l'elemento camera");
        // Rileva il codec automaticamente invece di assumere sempre H.264:
        // un URL diretto puo' essere MJPEG (es. una webcam economica) tanto
        // quanto H.264 (es. una vera telecamera IP) — stesso approccio
        // universale usato per le entita' HA.
        const check = await checkCameraCompatibility(streamUrl);
        if (!check.ok) throw new Error(check.error || "sorgente non raggiungibile");
        if (check.codec === "mjpeg") { mode = "mjpeg"; insertAud = "false"; }
        else if (check.codec === "h264") { mode = "h264"; insertAud = "true"; }
        else throw new Error(`codec "${check.codec}" non supportato (solo H.264 o MJPEG)`);
    } else {
        if (!cam.entity) throw new Error("nessuna entita' impostata per l'elemento camera");

        // camera_proxy_stream: la STESSA cosa che usa il frontend di Lovelace
        // per davvero (verificato negli strumenti sviluppatore del browser) —
        // un flusso MJPEG continuo, autenticato con il token dell'entita'
        // stessa passato come query string. Il citofono lo legge DIRETTAMENTE
        // (niente relay, niente add-on di mezzo, niente H.264): un solo
        // passaggio di decodifica (JPEG) invece di tre, risultato universale
        // per qualunque camera.* dato che questo endpoint da' sempre MJPEG a
        // prescindere dal codec nativo della telecamera.
        console.log("[c100x-dashboard] CAMERA leggo il token dell'entita':", cam.entity);
        streamUrl = await getCameraProxyStreamUrl(cam.entity);
        console.log("[c100x-dashboard] CAMERA sorgente (camera_proxy_stream):", streamUrl);
        mode = "mjpeg";
        insertAud = "false";

        startCameraRefreshTimer(cam.id, { host, entity: cam.entity, x: Math.round(cam.x || 0), y: Math.round(cam.y || 0), w: Math.round(cam.w || 10), h: Math.round(cam.h || 10) });
    }

    console.log("[c100x-dashboard] CAMERA avvio pipeline sul controller, id:", cam.id, "modalita':", mode, "coords:", cam.x, cam.y, cam.w, cam.h);
    const r = await controllerFetch(host, "camera-stream", {
        start: "true", id: cam.id,
        url: encodeURIComponent(streamUrl),
        x: Math.round(cam.x || 0), y: Math.round(cam.y || 0),
        w: Math.round(cam.w || 10), h: Math.round(cam.h || 10),
        mode, insertaud: insertAud
    });
    console.log("[c100x-dashboard] CAMERA risposta controller:", JSON.stringify(r));
}

function startCameraRefreshTimer(id, state) {
    stopCameraRefreshTimer(id);
    const timer = setInterval(async () => {
        try {
            const freshUrl = await getCameraProxyStreamUrl(state.entity);
            console.log("[c100x-dashboard] CAMERA rinnovo token (id:", id, "), riavvio pipeline");
            await controllerFetch(state.host, "camera-stream", {
                start: "true", id,
                url: encodeURIComponent(freshUrl),
                x: state.x, y: state.y, w: state.w, h: state.h, mode: "mjpeg", insertaud: "false"
            });
        } catch (e) {
            console.log("[c100x-dashboard] CAMERA rinnovo token fallito (id:", id, "):", e.message);
        }
    }, TOKEN_REFRESH_INTERVAL_MS);
    cameraRefreshTimers.set(id, timer);
}

function stopCameraRefreshTimer(id) {
    const timer = cameraRefreshTimers.get(id);
    if (timer) clearInterval(timer);
    cameraRefreshTimers.delete(id);
}

function stopAllCameraRefreshTimers() {
    for (const id of [...cameraRefreshTimers.keys()]) stopCameraRefreshTimer(id);
}

async function stopCameraOnController() {
    stopAllCameraRefreshTimers();
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) return;
    await controllerFetch(host, "camera-stream", { stop: "true" }); // senza "id": ferma tutte le pipeline attive
}

// --- Endpoint per il citofono ---
let lastPoll = 0;
let lastRv = "";
let lastRvSeen = 0;
const RV_FILE = path.join(DATA, "renderer.json");
try { const j = JSON.parse(fs.readFileSync(RV_FILE, "utf8")); lastRv = j.rv || ""; lastRvSeen = j.seen || 0; } catch (_) {}
function persistRv() { try { fs.writeFileSync(RV_FILE, JSON.stringify({ rv: lastRv, seen: lastRvSeen })); } catch (_) {} }
// Risolve gli elementi di un layout allo stato ATTUALE di HA: valori entita',
// icone+colore, template renderizzati, colore condizionale. Modifica out.elements
// in-place e lo ritorna. Usato sia da /active (citofono) sia dalle anteprime home.
async function resolveElementsLive(out) {
    const els = out.elements || [];
    const ids = [...new Set(
        els.filter(el => (el.type === "entity" || el.type === "entity-icon") && el.entity)
           .map(el => el.entity)
    )];
    const attrsById = {};
    for (const el of els) {
        if (el.type === "entity" && el.entity && el.attribute) {
            (attrsById[el.entity] = attrsById[el.entity] || []).push(el.attribute);
        }
    }
    let data = {};
    if (ids.length) { try { data = await fetchEntityData(ids, attrsById); } catch { data = {}; } }

    for (const el of els) {
        if (el.type === "entity" && el.entity) {
            const d = data[el.entity];
            if (d) {
                let val, isNum;
                if (el.attribute) {
                    const av = d.at && (el.attribute in d.at) ? d.at[el.attribute] : null;
                    val = (av === null || av === undefined) ? "?" : av;
                    isNum = isFinite(parseFloat(av));
                } else {
                    val = (d.t !== undefined && d.t !== null) ? d.t : d.s;
                    isNum = isFinite(parseFloat(d.s));
                }
                el.value = val;
                if (el.dateFormat) el.value = formatDate(el.value, el.dateFormat, "it");
                const autoUnit = (el.autoUnit === undefined) ? true : !!el.autoUnit;
                if (autoUnit && d.u && !el.suffix && isNum) el.suffix = " " + d.u;
            } else {
                try { const s = await getState(el.entity); el.value = s.state; } catch { el.value = "?"; }
            }
        } else if (el.type === "entity-icon" && el.entity) {
            const d = data[el.entity];
            const name = (el.forceIcon && String(el.forceIcon).trim())
                ? String(el.forceIcon).trim()
                : iconForEntity(el.entity, d, MDI_NAMES);
            const color = colorForEntity(el.entity, d, el);
            el.type = "icon";
            el.icon = name || "help-circle-outline";
            el.color = color;
            await applyConditionalColor(el);
        } else if (el.type === "template") {
            let out2 = "";
            try { out2 = await renderTemplate(el.template || ""); } catch (e) { out2 = "⚠ " + String(e).slice(0, 100); }
            el.value = markdownToHtml(out2);
            el.rich = true;
            await applyConditionalColor(el);
        } else if (el.type === "icon") {
            await applyConditionalColor(el);
        }
    }
    return out;
}

app.get("/active", async (req, res) => {
    lastPoll = Date.now();
    const rvq = (req.query.rv || "").toString();
    lastRvSeen = lastPoll;
    if (rvq !== lastRv) { lastRv = rvq; persistRv(); }
    try {
        const a = await readActive();
        const base = { name: a.name || null, background: "#000000", elements: [], showSeq: a.showSeq || 0, hideSeq: a.hideSeq || 0, duration: a.duration || 0 };
        if (!a.name) return res.json(base);
        const layout = JSON.parse(await fsp.readFile(layoutPath(a.name), "utf8"));
        const out = JSON.parse(JSON.stringify(layout));
        await resolveElementsLive(out);
        out.showSeq = a.showSeq || 0;
        out.hideSeq = a.hideSeq || 0;
        out.duration = a.duration || 0;
        out.name = a.name;
        // Passa alla QML solo cio' che le serve dei pulsanti: presenza azione + toast.
        // Il payload completo dell'azione resta sul server (eseguito da /api/action).
        // Il testo del toast puo' contenere Jinja2 (es. "Luce {{ 'accesa' if is_state(...) }}"):
        // in quel caso lo renderizziamo ad ogni poll, cosi' il messaggio e' dinamico.
        if (layout.buttons && typeof layout.buttons === "object") {
            const bout = {};
            const entries = Object.entries(layout.buttons).filter(([, v]) => v);
            await Promise.all(entries.map(async ([k, v]) => {
                let toast = null;
                if (v.toast && v.toast.text) {
                    let text = v.toast.text;
                    if (/\{\{|\{%/.test(text)) {
                        try { text = await renderTemplate(text); } catch { /* lascia il testo originale */ }
                    }
                    toast = { text, seconds: v.toast.seconds || 2 };
                }
                bout[k] = {
                    action: v.action ? true : false,
                    toast,
                    light: v.light ? true : false
                };
            }));
            out.buttons = bout;
        }
        res.json(out);
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/api/citofono/live", async (req, res) => {
    const a = await readActive();
    const online = (Date.now() - lastPoll) < 6000;
    const showing = online && lastSchedaShown !== null && lastSchedaShown !== "idle";
    res.json({
        online,
        lastSeen: lastPoll || null,
        activeName: showing ? lastSchedaShown : null,
        showing
    });
});

app.get("/api/citofono/status", async (req, res) => {
    const c = await readCfg();
    const online = (Date.now() - lastPoll) < 6000;
    let state, stale;
    if (!online) { state = "offline"; stale = false; }
    else if (!lastRv) { state = "legacy"; stale = true; }
    else if (lastRv !== RENDERER_VERSION) { state = "outdated"; stale = true; }
    else { state = "current"; stale = false; }
    res.json({
        shipped: RENDERER_VERSION,
        deployed: lastRv || null,
        online, state, stale,
        lastSeen: lastPoll || null,
        canInstall: !!SSHClient && !!c.password && !!c.host
    });
});

// ===== Provisioning del citofono via SSH =====
let SSHClient = null;
try { SSHClient = require("ssh2").Client; } catch (e) { console.warn("[c100x-dashboard] ssh2 non disponibile:", e.message); }

const CITOFONO_DIR = fs.existsSync("/citofono") ? "/citofono" : path.join(__dirname, "..", "citofono");
const CFG_FILE = path.join(DATA, "citofono.json");
const DEFAULT_NODE = "/home/bticino/cfg/extra/node/bin/node";

async function readCfg() { try { return JSON.parse(await fsp.readFile(CFG_FILE, "utf8")); } catch { return {}; } }
async function writeCfg(c) { await fsp.writeFile(CFG_FILE, JSON.stringify(c, null, 2)); }

function sshConnect(o) {
    return new Promise((res, rej) => {
        const conn = new SSHClient();
        conn.on("ready", () => res(conn)).on("error", rej);
        conn.connect({
            host: o.host, port: o.port || 22, username: o.username, password: o.password,
            readyTimeout: 15000, keepaliveInterval: 0,
            // Algoritmi legacy richiesti da dropbear sul citofono
            algorithms: {
                kex: ["diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1", "diffie-hellman-group1-sha1"],
                cipher: ["aes128-cbc", "aes128-ctr", "3des-cbc"],
                serverHostKey: ["ssh-rsa", "ssh-dss"],
                hmac: ["hmac-sha1", "hmac-md5"]
            }
        });
    });
}
function sshExec(conn, cmd, stdin) {
    return new Promise((res, rej) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return rej(err);
            let out = "", errout = "";
            stream.on("close", (code) => res({ code, out, errout }))
                .on("data", (d) => out += d)
                .stderr.on("data", (d) => errout += d);
            stream.end(stdin !== undefined ? stdin : undefined);
        });
    });
}

app.get("/api/citofono/settings", async (req, res) => {
    const c = await readCfg();
    res.json({
        host: c.host || "", port: c.port || 22, username: c.username || "root",
        addonBase: c.addonBase || "", nodePath: c.nodePath || DEFAULT_NODE,
        savePassword: !!c.savePassword, hasPassword: !!c.password,
        haUrl: c.haUrl || "",
        sshAvailable: !!SSHClient
    });
});

app.post("/api/citofono/settings", async (req, res) => {
    const b = req.body || {};
    const c = await readCfg();
    c.host = (b.host || "").trim();
    c.port = parseInt(b.port) || 22;
    c.username = (b.username || "root").trim();
    c.addonBase = (b.addonBase || "").trim();
    c.nodePath = (b.nodePath || "").trim() || DEFAULT_NODE;
    c.savePassword = !!b.savePassword;
    c.haUrl = (b.haUrl || "").trim().replace(/\/+$/, "");
    if (c.savePassword) { if (b.password) c.password = b.password; }
    else { delete c.password; }
    await writeCfg(c);
    res.json({ ok: true, hasPassword: !!c.password });
});

app.post("/api/citofono/install", async (req, res) => {
    if (!SSHClient) return res.status(500).json({ ok: false, error: "ssh2 non disponibile nell'immagine" });
    const b = req.body || {};
    const c = await readCfg();
    const host = (b.host || c.host || "").trim();
    const port = parseInt(b.port || c.port) || 22;
    const username = (b.username || c.username || "root").trim();
    const password = b.password || c.password;
    const addonBase = (b.addonBase || c.addonBase || "").trim().replace(/\/+$/, "");
    const nodePath = (b.nodePath || c.nodePath || DEFAULT_NODE).trim();
    const reboot = b.reboot !== false;

    if (!host || !username || !password) return res.status(400).json({ ok: false, error: "host, utente e password sono obbligatori" });
    if (!/^https?:\/\/[A-Za-z0-9._-]+(:\d+)?$/.test(addonBase)) return res.status(400).json({ ok: false, error: "URL add-on non valido (es. http://192.168.1.10:8099)" });
    if (!/^[A-Za-z0-9._/-]+$/.test(nodePath)) return res.status(400).json({ ok: false, error: "percorso node non valido" });

    let qml, patch, vncScript, controllerBundle, mainPagePatch, ptraceInject, ffmpegBin, vpuDecodeBin, fbBlitBin;
    try {
        qml = fs.readFileSync(path.join(CITOFONO_DIR, "SchedaPage.qml"), "utf8");
        patch = fs.readFileSync(path.join(CITOFONO_DIR, "patch-scheda-qml.js"), "utf8");
        vncScript = fs.readFileSync(path.join(CITOFONO_DIR, "fb-vnc.js"), "utf8");
        controllerBundle = fs.readFileSync(path.join(CITOFONO_DIR, "controller-bundle-webrtc.js"), "utf8");
        mainPagePatch = fs.readFileSync(path.join(CITOFONO_DIR, "patch-mainpage-qml.js"), "utf8");
        ptraceInject = fs.readFileSync(path.join(CITOFONO_DIR, "ptrace-inject-armhf")); // binario: niente "utf8", Buffer grezzo
        ffmpegBin = fs.readFileSync(path.join(CITOFONO_DIR, "ffmpeg-armhf")); // binario, per l'elemento telecamera
        vpuDecodeBin = fs.readFileSync(path.join(CITOFONO_DIR, "vpu-fb-decode-armhf")); // binario, decodifica hardware H.264 (URL diretti gia' compatibili)
        fbBlitBin = fs.readFileSync(path.join(CITOFONO_DIR, "fb-blit-armhf")); // binario, disegna pixel grezzi MJPEG (modalita' principale, universale)
    } catch (e) { return res.status(500).json({ ok: false, error: "file QML/patch non trovati: " + e.message }); }

    const log = [];
    let conn = null;
    try {
        conn = await sshConnect({ host, port, username, password });
        log.push("Connesso a " + host + ":" + port);
        await sshExec(conn, "cat > /home/bticino/cfg/extra/SchedaPage.qml", qml);
        log.push("SchedaPage.qml caricato");
        await sshExec(conn, "cat > /home/bticino/cfg/extra/patch-scheda-qml.js", patch);
        log.push("patch-scheda-qml.js caricato");
        await sshExec(conn, "mkdir -p /home/bticino/cfg/extra/fb-vnc && cat > /home/bticino/cfg/extra/fb-vnc/fb-vnc.js", vncScript);
        log.push("fb-vnc.js caricato (visualizzazione live)");

        const script = [
            "mount -oremount,rw /",
            "cp /home/bticino/cfg/extra/SchedaPage.qml /home/bticino/bin/gui/skins/default/SchedaPage.qml",
            "[ -f /home/bticino/cfg/extra/main.qml.bak.prescheda ] || cp /home/bticino/bin/gui/skins/default/main.qml /home/bticino/cfg/extra/main.qml.bak.prescheda",
            nodePath + " /home/bticino/cfg/extra/patch-scheda-qml.js /home/bticino/bin/gui/skins/default/main.qml '" + addonBase + "' '" + RENDERER_VERSION + "'",
            "mount -oremount,ro /",
            "echo DONE_SCHEDE"
        ].join(" && ");
        const r = await sshExec(conn, script);
        if (r.out) log.push(r.out.trim());
        if (r.errout) log.push("stderr: " + r.errout.trim());
        if (r.out.indexOf("DONE_SCHEDE") < 0 && r.out.indexOf("gia' patchato") < 0)
            throw new Error("la patch non ha confermato il completamento (controlla il percorso node e i permessi)");

        await sshExec(conn, "cat > /home/bticino/cfg/extra/patch-mainpage-qml.js", mainPagePatch);
        const mpScript = [
            "mount -oremount,rw /",
            "[ -f /home/bticino/cfg/extra/MainPage.qml.bak.premainpage ] || cp /home/bticino/bin/gui/skins/default/MainPage.qml /home/bticino/cfg/extra/MainPage.qml.bak.premainpage",
            nodePath + " /home/bticino/cfg/extra/patch-mainpage-qml.js /home/bticino/bin/gui/skins/default/MainPage.qml",
            "mount -oremount,ro /",
            "echo DONE_MAINPAGE"
        ].join(" && ");
        const rmp = await sshExec(conn, mpScript);
        if (rmp.out) log.push(rmp.out.trim());
        if (rmp.errout) log.push("stderr: " + rmp.errout.trim());
        if (rmp.out.indexOf("DONE_MAINPAGE") < 0 && rmp.out.indexOf("gia' patchato") < 0)
            log.push("ATTENZIONE: patch di MainPage.qml (rotella su menu nativo) non confermata, il resto e' comunque andato a buon fine.");

        log.push("Installazione del controller c300x personalizzato (supporto avvio/stop VNC)…");
        await sshExec(conn, "cat > /home/bticino/cfg/extra/controller-bundle-webrtc.js", controllerBundle);
        const cscript = [
            "mount -oremount,rw /",
            "[ -f /home/bticino/cfg/extra/c300x-controller/bundle.js.bak-preaddon ] || cp /home/bticino/cfg/extra/c300x-controller/bundle.js /home/bticino/cfg/extra/c300x-controller/bundle.js.bak-preaddon",
            "cp /home/bticino/cfg/extra/controller-bundle-webrtc.js /home/bticino/cfg/extra/c300x-controller/bundle.js",
            "mount -oremount,ro /",
            "/etc/init.d/c300x-controller restart",
            "echo DONE_CONTROLLER"
        ].join(" && ");
        const rc = await sshExec(conn, cscript);
        if (rc.out) log.push(rc.out.trim());
        if (rc.errout) log.push("stderr: " + rc.errout.trim());
        if (rc.out.indexOf("DONE_CONTROLLER") < 0)
            log.push("ATTENZIONE: il controller potrebbe non essere ripartito correttamente, verifica su :8080");
        else
            log.push("Controller aggiornato e riavviato (backup in bundle.js.bak-preaddon).");

        log.push("Caricamento dell'iniettore ptrace (per il pannello pulsanti nella vista live)…");
        await sshExec(conn, "cat > /home/bticino/cfg/extra/ptrace-inject-armhf", ptraceInject);
        const rpi = await sshExec(conn, "chmod +x /home/bticino/cfg/extra/ptrace-inject-armhf && echo DONE_PTRACE");
        if (rpi.out) log.push(rpi.out.trim());
        if (rpi.errout) log.push("stderr: " + rpi.errout.trim());
        if (rpi.out.indexOf("DONE_PTRACE") < 0)
            log.push("ATTENZIONE: l'iniettore ptrace potrebbe non essere stato installato correttamente.");

        log.push("Caricamento di ffmpeg e dei decoder (per l'elemento telecamera)…");
        await sshExec(conn, "cat > /home/bticino/cfg/extra/ffmpeg-armhf", ffmpegBin);
        await sshExec(conn, "cat > /home/bticino/cfg/extra/vpu-fb-decode-armhf", vpuDecodeBin);
        await sshExec(conn, "cat > /home/bticino/cfg/extra/fb-blit-armhf", fbBlitBin);
        const rcam = await sshExec(conn, "chmod +x /home/bticino/cfg/extra/ffmpeg-armhf /home/bticino/cfg/extra/vpu-fb-decode-armhf /home/bticino/cfg/extra/fb-blit-armhf && echo DONE_CAMERA");
        if (rcam.out) log.push(rcam.out.trim());
        if (rcam.errout) log.push("stderr: " + rcam.errout.trim());
        if (rcam.out.indexOf("DONE_CAMERA") < 0)
            log.push("ATTENZIONE: ffmpeg/decoder potrebbero non essere stati installati correttamente — l'elemento telecamera non funzionera'.");

        if (reboot) {
            // Il comando DEVE sopravvivere alla chiusura della sessione SSH: senza
            // setsid il processo in background riceve SIGHUP durante lo sleep e il
            // reboot non parte mai. Usiamo anche il path completo (PATH minimale in
            // shell non interattiva) con fallback, e stdin da /dev/null.
            const rebootCmd = "setsid sh -c 'sleep 2; /sbin/reboot 2>/dev/null || reboot' </dev/null >/dev/null 2>&1 &";
            try { await sshExec(conn, rebootCmd); log.push("Riavvio del citofono richiesto (tra ~2s)…"); } catch (_) {}
        } else {
            log.push("Fatto. Riavvia il citofono per ricaricare la GUI.");
        }
        conn.end();
        res.json({ ok: true, log });
    } catch (e) {
        try { if (conn) conn.end(); } catch (_) {}
        log.push("ERRORE: " + (e.message || e));
        res.status(502).json({ ok: false, log, error: String(e.message || e) });
    }
});

app.get("/health", (req, res) => res.json({ ok: true, version: VERSION }));

// ===== Visualizzazione live (VNC) nell'editor =====
// L'add-on fa da semplice tubo WebSocket <-> TCP verso fb-vnc.js sul citofono
// (avviato/fermato tramite l'endpoint /fb-vnc del c300x-controller). Il
// protocollo RFB vero e proprio (handshake, flow control, decoding) e'
// gestito da noVNC nel browser - un client maturo e collaudato. La nostra
// precedente implementazione artigianale (client RFB scritto a mano dentro
// l'add-on, conversione in PNG, polling a intervallo fisso) si e' rivelata
// troppo aggressiva per l'hardware debole del citofono: richiedeva un nuovo
// frame ogni Xms a prescindere da quanto tempo impiegasse il citofono a
// rispondere, invece di aspettare la risposta precedente come fa un vero
// client VNC — causava lag crescente e, sotto carico, crash del processo
// sul citofono. Con noVNC quel problema sparisce perche' il flow control e'
// gestito correttamente.
const { WebSocketServer } = require("ws");
const net = require("net");

const VNC_PORT = 5900;
const CONTROLLER_PORT = 8080;

async function controllerFetch(host, endpoint, params) {
    const qs = new URLSearchParams({ ...(params || {}), raw: "true" }).toString();
    const url = `http://${host}:${CONTROLLER_PORT}/${endpoint}?${qs}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`controller (${endpoint}) risposto ${r.status}`);
    return r.json().catch(() => ({}));
}

app.post("/api/live/start", async (req, res) => {
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) return res.status(400).json({ ok: false, error: "host del citofono non configurato (vedi impostazioni SSH)" });
    try {
        await controllerFetch(host, "fb-vnc", { start: "true" });
    } catch (e) {
        return res.status(502).json({ ok: false, error: "impossibile avviare il VNC sul citofono: " + e.message });
    }
    // L'iniettore di input e' un bonus (i pulsanti nella live view): se non
    // riesce a partire, il video continua comunque a funzionare.
    try {
        await controllerFetch(host, "ptrace-inject", { start: "true" });
    } catch (e) {
        console.warn("[c100x-dashboard] avvio ptrace-inject fallito (i pulsanti nella live view non funzioneranno):", e.message);
    }
    res.json({ ok: true });
});

app.post("/api/live/stop", async (req, res) => {
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (host) {
        try { await controllerFetch(host, "fb-vnc", { stop: "true" }); } catch (e) { /* non bloccante */ }
        try { await controllerFetch(host, "ptrace-inject", { stop: "true" }); } catch (e) { /* non bloccante */ }
    }
    res.json({ ok: true });
});

// Proxy WebSocket <-> TCP grezzo verso citofono:5900. Non tocchiamo il
// protocollo RFB per niente: passano solo byte, in entrambe le direzioni.
const liveWss = new WebSocketServer({ noServer: true });
const liveSockets = new Set();
let liveStopTimer = null;

liveWss.on("connection", async (ws) => {
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) { ws.close(1011, "host non configurato"); return; }

    if (liveStopTimer) { clearTimeout(liveStopTimer); liveStopTimer = null; }

    const tcp = net.connect(VNC_PORT, host);
    tcp.setNoDelay(true);
    liveSockets.add(ws);

    tcp.on("data", (chunk) => { if (ws.readyState === ws.OPEN) ws.send(chunk); });
    tcp.on("error", (e) => {
        console.warn("[c100x-dashboard] live: errore TCP verso citofono:", e.message);
        try { ws.close(1011, e.message); } catch (_) { /* noop */ }
    });
    tcp.on("close", () => { try { ws.close(); } catch (_) { /* noop */ } });

    ws.on("message", (data) => { if (!tcp.destroyed) tcp.write(data); });
    ws.on("close", () => {
        liveSockets.delete(ws);
        try { tcp.destroy(); } catch (_) { /* noop */ }
        // Se non resta nessun client collegato, fermiamo il VNC sul citofono
        // dopo una breve grazia (evita di fermarlo per un reload rapido).
        if (liveSockets.size === 0) {
            if (liveStopTimer) clearTimeout(liveStopTimer);
            liveStopTimer = setTimeout(() => {
                liveStopTimer = null;
                readCfg().then((cc) => {
                    if (!cc.host) return;
                    const h = cc.host.trim();
                    controllerFetch(h, "fb-vnc", { stop: "true" }).catch(() => {});
                    controllerFetch(h, "ptrace-inject", { stop: "true" }).catch(() => {});
                });
            }, 5000);
        }
    });
    ws.on("error", (e) => { console.warn("[c100x-dashboard] live: errore WebSocket:", e.message); });
});

// ===== Simulazione pulsanti reali durante la visualizzazione live =====
// Chiamata diretta al controller (endpoint /ptrace-inject), che inietta la
// pressione a livello di sistema (syscall) sul citofono — indistinguibile
// da una pressione fisica vera per il firmware, funziona ovunque (menu
// nativo incluso), non solo dentro le nostre schede.
const BUTTON_KEY_MAP = {
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7",
    "up": "up", "down": "down", "ok": "ok",
    "call": "connect", "hangup": "close"
};

app.post("/api/live/button", async (req, res) => {
    const b = req.body || {};
    const button = String(b.button || "").trim();
    const phase = b.phase === "release" ? "release" : "press";
    const key = BUTTON_KEY_MAP[button];
    if (!key) return res.status(400).json({ ok: false, error: "pulsante non valido" });

    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) return res.status(400).json({ ok: false, error: "host del citofono non configurato" });

    try {
        const r = await controllerFetch(host, "ptrace-inject", { key, phase });
        res.json({ ok: true, message: r.message });
    } catch (e) {
        res.status(502).json({ ok: false, error: "invio al citofono fallito: " + e.message });
    }
});

// ===== Stato retroilluminazione display (per l'entita' light in HA) =====
// Letto periodicamente dal nuovo endpoint del controller (/backlight-status),
// che legge il sysfs del kernel direttamente — non piu' dal QML/global.screenState
// di Qt. Motivo: durante e subito dopo una chiamata in arrivo, lo stato
// Qt-side puo' disallinearsi dalla realta' (osservato: l'entita' restava "on"
// con lo schermo fisicamente spento). Il sysfs riflette sempre lo stato vero,
// indipendentemente da eventuali intoppi del QML in quel momento.
let backlightOn = null; // null = non ancora letto
let backlightQueue = [];

async function pollBacklightOnce() {
    try {
        const c = await readCfg();
        const host = (c.host || "").trim();
        if (!host) return;
        const r = await fetch(`http://${host}:${CONTROLLER_PORT}/backlight-status?raw=true`, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return;
        const d = await r.json();
        if (typeof d.on === "boolean") backlightOn = d.on;
    } catch (e) { /* non bloccante: manteniamo l'ultimo valore noto finche' non torna a rispondere */ }
}
pollBacklightOnce();
setInterval(pollBacklightOnce, 1500);

// DIAGNOSTICA TEMPORANEA: legge il log di ffmpeg e l'elenco dei file prodotti
// dal relay — il container dell'add-on non e' raggiungibile via SSH come il
// citofono, serve un modo per guardarci dentro dal browser. Da rimuovere una
// volta capito il problema.
// DIAGNOSTICA TEMPORANEA: elenca eventuali processi ffmpeg rimasti appesi da
// test precedenti (letto direttamente da /proc, senza bisogno del binario
// "ps" che potrebbe non essere installato) e il carico di sistema. Da
// rimuovere una volta capito il problema.
app.get("/api/debug-processes", (req, res) => {
    let out = "";
    try { out += "=== /proc/loadavg ===\n" + fs.readFileSync("/proc/loadavg", "utf8") + "\n"; } catch (e) { out += "loadavg non disponibile: " + e.message + "\n"; }
    out += "\n=== processi con 'ffmpeg' nella cmdline ===\n";
    try {
        const pids = fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p));
        let found = 0;
        for (const pid of pids) {
            try {
                const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
                if (cmdline.includes("ffmpeg")) {
                    found++;
                    let stat = "";
                    try { stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim(); } catch (e) {}
                    out += `PID ${pid}: ${cmdline}\n`;
                }
            } catch (e) { /* processo sparito nel frattempo, ignora */ }
        }
        if (!found) out += "(nessuno)\n";
    } catch (e) { out += "errore lettura /proc: " + e.message + "\n"; }
    res.type("text/plain").send(out);
});

app.get("/api/backlight-state", (req, res) => {
    res.json({ on: backlightOn });
});

app.post("/api/backlight-command", (req, res) => {
    const b = req.body || {};
    backlightQueue.push({ on: !!b.on });
    res.json({ ok: true });
});

app.get("/api/backlight-pending", (req, res) => {
    const pending = backlightQueue;
    backlightQueue = [];
    res.json({ commands: pending });
});

// Diagnostica: testa la sola connettivita' TCP verso citofono:5900, senza
// nessuna logica RFB, per isolare "il container riesce ad aprire il socket?"
// da "il protocollo RFB funziona?".
app.get("/api/live/debug-connect", async (req, res) => {
    const c = await readCfg();
    const host = (c.host || "").trim();
    if (!host) return res.status(400).json({ ok: false, error: "host non configurato" });
    const result = await new Promise((resolve) => {
        const start = Date.now();
        const socket = net.connect({ host, port: VNC_PORT, timeout: 5000 });
        socket.on("connect", () => {
            resolve({ ok: true, ms: Date.now() - start });
            socket.destroy();
        });
        socket.on("timeout", () => {
            resolve({ ok: false, error: "timeout", ms: Date.now() - start });
            socket.destroy();
        });
        socket.on("error", (e) => {
            resolve({ ok: false, error: e.message, code: e.code, ms: Date.now() - start });
        });
    });
    res.json({ host, port: VNC_PORT, ...result });
});

const httpServer = app.listen(PORT, () => {
    console.log(`[c100x-dashboard] v${VERSION} in ascolto sulla porta ${PORT}`);
    console.log(`[c100x-dashboard] SUPERVISOR_TOKEN ${SUPERVISOR_TOKEN ? "presente" : "ASSENTE"}`);
});

httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api/live/ws" || pathname.endsWith("/api/live/ws")) {
        liveWss.handleUpgrade(request, socket, head, (ws) => {
            liveWss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});
