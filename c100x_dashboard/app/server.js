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

const app = express();
const PORT = 8099;
const VERSION = "0.10.0";
// Versione del renderer lato citofono (SchedaPage.qml + blocco watcher).
// Bumpare SOLO quando cambiano quei file, cosi\' l\'add-on sa se il citofono e\' da aggiornare.
const RENDERER_VERSION = "7";

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
    lastSchedaShown = name || "idle";
    res.json({ ok: true, state: lastSchedaShown });
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
});

// Nasconde la scheda (es. quando torna la corrente)
app.post("/api/hide", async (req, res) => {
    const a = await readActive();
    a.hideSeq = Date.now();
    await writeActive(a);
    res.json({ ok: true, hideSeq: a.hideSeq });
});

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

    let qml, patch;
    try {
        qml = fs.readFileSync(path.join(CITOFONO_DIR, "SchedaPage.qml"), "utf8");
        patch = fs.readFileSync(path.join(CITOFONO_DIR, "patch-scheda-qml.js"), "utf8");
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

app.listen(PORT, () => {
    console.log(`[c100x-dashboard] v${VERSION} in ascolto sulla porta ${PORT}`);
    console.log(`[c100x-dashboard] SUPERVISOR_TOKEN ${SUPERVISOR_TOKEN ? "presente" : "ASSENTE"}`);
});
