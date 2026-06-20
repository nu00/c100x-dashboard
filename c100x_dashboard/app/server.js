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
const VERSION = "0.8.0";

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

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

app.use(express.json({ limit: "16mb" }));
app.use(express.static(path.join(__dirname, "static"), {
    setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.setHeader("Cache-Control", "no-cache"); }
}));
app.use("/image", express.static(IMAGES_DIR));
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

app.get("/api/state/:entity", async (req, res) => {
    try { res.json(await getState(req.params.entity)); } catch (e) { res.status(502).json({ error: String(e) }); }
});

app.get("/api/entities", async (req, res) => {
    try {
        const states = await getAllStates();
        res.json(states.map(s => ({ id: s.entity_id, name: (s.attributes && s.attributes.friendly_name) || s.entity_id })));
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
        if (c.length === 6) svg = svg.replace(/<svg /, `<svg fill="#${c}" `);
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
app.get("/api/layouts/:name", async (req, res) => {
    if (!safeName(req.params.name)) return res.status(400).json({ error: "nome non valido" });
    try { res.json(JSON.parse(await fsp.readFile(layoutPath(req.params.name), "utf8"))); }
    catch { res.status(404).json({ error: "layout non trovato" }); }
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
app.get("/active", async (req, res) => {
    try {
        const a = await readActive();
        const base = { name: a.name || null, background: "#000000", elements: [], showSeq: a.showSeq || 0, hideSeq: a.hideSeq || 0, duration: a.duration || 0 };
        if (!a.name) return res.json(base);
        const layout = JSON.parse(await fsp.readFile(layoutPath(a.name), "utf8"));
        const out = JSON.parse(JSON.stringify(layout));
        for (const el of out.elements || []) {
            if (el.type === "entity" && el.entity) {
                try { const s = await getState(el.entity); el.value = s.state; } catch { el.value = "?"; }
            }
        }
        out.showSeq = a.showSeq || 0;
        out.hideSeq = a.hideSeq || 0;
        out.duration = a.duration || 0;
        res.json(out);
    } catch (e) { res.status(500).json({ error: String(e) }); }
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
            nodePath + " /home/bticino/cfg/extra/patch-scheda-qml.js /home/bticino/bin/gui/skins/default/main.qml '" + addonBase + "'",
            "mount -oremount,ro /",
            "echo DONE_SCHEDE"
        ].join(" && ");
        const r = await sshExec(conn, script);
        if (r.out) log.push(r.out.trim());
        if (r.errout) log.push("stderr: " + r.errout.trim());
        if (r.out.indexOf("DONE_SCHEDE") < 0 && r.out.indexOf("gia' patchato") < 0)
            throw new Error("la patch non ha confermato il completamento (controlla il percorso node e i permessi)");

        if (reboot) {
            try { await sshExec(conn, "(sleep 1 && reboot) >/dev/null 2>&1 &"); log.push("Riavvio del citofono in corso…"); } catch (_) {}
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
