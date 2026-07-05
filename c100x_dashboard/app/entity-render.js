/*
 * entity-render.js — risoluzione stato tradotto + icona "come Lovelace" per le entità.
 *
 * Due responsabilità:
 *  1) fetchEntityData(ids): una sola chiamata /api/template che ritorna, per ogni entità,
 *     stato grezzo + stato tradotto (state_translated) + unità + attributi utili all'icona.
 *  2) iconForEntity(entityId, d, mdiNames): calcola il nome icona MDI in base a
 *     device_class + stato (batteria a step, cover per device_class, ecc.), validando
 *     il nome contro il set MDI realmente disponibile (fallback sicuro se non esiste).
 *
 * Nessuna dipendenza dal renderer del citofono: l'add-on serve solo il nome icona,
 * la SchedaPage la disegna come una qualsiasi icona MDI.
 */

// --- Batteria: stessa logica a step del frontend HA (arrotonda a 10) ---
function batteryIcon(level, charging, mdiNames) {
    const v = Number(level);
    if (!isFinite(v)) return safe("battery-unknown", mdiNames);
    const r = Math.round(v / 10) * 10;
    let name;
    if (charging) {
        if (r >= 100) name = "battery-charging-100";
        else if (r <= 0) name = "battery-charging-outline";
        else name = "battery-charging-" + r;
    } else {
        if (r >= 100) name = "battery";
        else if (r <= 0) name = "battery-outline";
        else name = "battery-" + r;
    }
    return safe(name, mdiNames);
}

// --- Cover: icona per device_class + stato (aperta/chiusa/in movimento) ---
// Coppie [chiuso, aperto]; opening/closing usano frecce. Nomi validati a runtime.
const COVER_MAP = {
    garage:  ["garage", "garage-open"],
    door:    ["door-closed", "door-open"],
    gate:    ["gate", "gate-open"],
    window:  ["window-closed", "window-open"],
    shutter: ["window-shutter", "window-shutter-open"],
    blind:   ["blinds-horizontal-closed", "blinds-horizontal"],
    curtain: ["curtains-closed", "curtains"],
    shade:   ["roller-shade-closed", "roller-shade"],
    awning:  ["awning-outline", "awning-outline"],
    damper:  ["valve-closed", "valve-open"],
};
function coverIcon(dc, state, mdiNames) {
    if (state === "opening") return safe("arrow-up-box", mdiNames);
    if (state === "closing") return safe("arrow-down-box", mdiNames);
    const pair = COVER_MAP[dc] || ["window-closed", "window-open"];
    const name = (state === "closed") ? pair[0] : pair[1];
    return safe(name, mdiNames, "window-open");
}

// --- Fallback generico per dominio + stato on/off ---
function domainIcon(domain, state, mdiNames) {
    // weather: lo stato è la condizione (sunny, rainy, ...) -> icona MDI dedicata
    if (domain === "weather") {
        const wmap = {
            "clear-night": "weather-night",
            "cloudy": "weather-cloudy",
            "fog": "weather-fog",
            "hail": "weather-hail",
            "lightning": "weather-lightning",
            "lightning-rainy": "weather-lightning-rainy",
            "partlycloudy": "weather-partly-cloudy",
            "pouring": "weather-pouring",
            "rainy": "weather-rainy",
            "snowy": "weather-snowy",
            "snowy-rainy": "weather-snowy-rainy",
            "sunny": "weather-sunny",
            "windy": "weather-windy",
            "windy-variant": "weather-windy-variant",
            "exceptional": "weather-cloudy-alert",
        };
        return safe(wmap[state] || "weather-cloudy", mdiNames, "weather-cloudy");
    }
    const on = (state === "on" || state === "open" || state === "home" || state === "playing");
    const map = {
        light:        on ? "lightbulb" : "lightbulb-outline",
        switch:       on ? "toggle-switch" : "toggle-switch-off",
        fan:          "fan",
        lock:         (state === "locked") ? "lock" : "lock-open-variant",
        binary_sensor: on ? "checkbox-marked-circle" : "checkbox-blank-circle-outline",
        person:       (state === "home") ? "account" : "account-outline",
        device_tracker: (state === "home") ? "account" : "account-outline",
        climate:      "thermostat",
        media_player: on ? "play-circle" : "pause-circle",
        sensor:       "eye",
        automation:   "robot",
        script:       "script-text",
        sun:          (state === "above_horizon") ? "weather-sunny" : "weather-night",
    };
    return safe(map[domain] || "help-circle-outline", mdiNames, "help-circle-outline");
}

// Ritorna `name` se esiste tra le MDI disponibili, altrimenti `fallback` (a sua volta
// validato) o null. Cosi' un nome icona sbagliato non lascia mai un buco sul citofono.
function safe(name, mdiNames, fallback) {
    if (!mdiNames || mdiNames.has(name)) return name;
    if (fallback && mdiNames.has(fallback)) return fallback;
    return mdiNames.has("help-circle-outline") ? "help-circle-outline" : null;
}

// Palette colori di stato (modificabile). Modellata sui colori tipici di Lovelace.
const COL = {
    green:  "#4caf50",
    amber:  "#ff9800",
    red:    "#f44336",
    blue:   "#2196f3",
    yellow: "#ffc107",
    grey:   "#9e9e9e",
    white:  "#ffffff",
};

// Stati considerati "acceso/attivo" e "spento/inattivo" per il colore generico on/off.
const ON_STATES = new Set(["on", "open", "home", "playing", "active", "heat", "cool", "auto", "true", "yes"]);
const OFF_STATES = new Set(["off", "closed", "not_home", "paused", "idle", "standby", "away", "unavailable", "unknown", "false", "no"]);

/*
 * Colore dell'icona in base allo stato ("come Lovelace", con override manuale).
 *  entityId : es. "sensor.tel_battery"
 *  d        : { s, t, u, dc, ic, bl, ch }
 *  el       : l'elemento della scheda (per gli override: customColors, onColor, offColor, color)
 * Ritorna una stringa colore esadecimale (#rrggbb).
 */
function colorForEntity(entityId, d, el) {
    const base = (el && el.color) || COL.white;
    if (!d) return base;
    const domain = String(entityId).split(".")[0];
    const dc = d.dc || null;
    const state = (d.s == null) ? "" : String(d.s).toLowerCase();
    const on = ON_STATES.has(state);
    const off = OFF_STATES.has(state);

    // Override manuali acceso/spento (se abilitati nell'editor)
    if (el && el.customColors) {
        if (on && el.onColor) return el.onColor;
        if (off && el.offColor) return el.offColor;
    }

    // Batteria: verde/ambra/rosso per fascia, azzurro se in carica
    let level = null;
    if (dc === "battery" && isFinite(Number(state))) level = Number(state);
    else if (d.bl != null && isFinite(Number(d.bl))) level = Number(d.bl);
    if (level != null) {
        if (isCharging(d)) return COL.blue;
        if (level > 50) return COL.green;
        if (level >= 20) return COL.amber;
        return COL.red;
    }
    if (dc === "battery") return state === "on" ? COL.red : COL.green; // batteria "binaria": on = scarica

    // Cover: aperta ambra, chiusa grigia
    if (domain === "cover") return state === "closed" ? COL.grey : COL.amber;

    // Lock: bloccato verde, sbloccato rosso
    if (domain === "lock") return state === "locked" ? COL.green : COL.red;

    // Generico on/off
    if (on) return COL.yellow;
    if (off) return COL.grey;

    return base;
}

function isCharging(d) {
    const c = d.ch;
    if (c === true) return true;
    if (typeof c === "string") return ["on", "true", "charging", "yes"].includes(c.toLowerCase());
    return false;
}

/*
 * Calcola l'icona per un'entita'.
 *  entityId : es. "sensor.telefono_battery"
 *  d        : oggetto { s, t, u, dc, ic, bl, ch } dalla fetchEntityData
 *  mdiNames : Set dei nomi MDI disponibili (per validare); puo' essere null
 */
function iconForEntity(entityId, d, mdiNames) {
    if (!d) return null;
    const domain = String(entityId).split(".")[0];
    const dc = d.dc || null;
    const state = (d.s == null) ? "" : String(d.s);

    // 1) icona esplicita (impostata da te o dall'integrazione) -> ha priorita', come in Lovelace
    if (typeof d.ic === "string" && d.ic.indexOf("mdi:") === 0) {
        return safe(d.ic.slice(4), mdiNames);
    }

    // 2) batteria: livello numerico dallo stato (device_class battery) o da attributes.battery_level
    let level = null;
    if (dc === "battery" && isFinite(Number(state))) level = Number(state);
    else if (d.bl != null && isFinite(Number(d.bl))) level = Number(d.bl);
    if (level != null) return batteryIcon(level, isCharging(d), mdiNames);
    // batteria "binaria" (device_class battery ma stato on/off = scarica/ok)
    if (dc === "battery") return safe(state === "on" ? "battery-alert" : "battery", mdiNames);

    // 3) cover
    if (domain === "cover") return coverIcon(dc, state, mdiNames);

    // 4) fallback per dominio
    return domainIcon(domain, state, mdiNames);
}

/*
 * Costruisce UN template Jinja che ritorna un JSON { entityId: {s,t,u,dc,ic,bl,ch,at,an} }.
 * Una sola chiamata /api/template per tutte le entita' della scheda.
 *  - at: valori degli attributi RICHIESTI (mappa nome->valore), tradotti dove possibile
 *  - an: elenco dei nomi di tutti gli attributi disponibili (per la tendina nell'editor)
 * attrsById: opzionale { "sensor.x": ["temperature", ...] } elenca gli attributi da leggere.
 */
function buildTemplate(ids, attrsById) {
    attrsById = attrsById || {};
    const parts = ids.map((id) => {
        const e = JSON.stringify(id); // "sensor.x" con doppi apici, valido in Jinja
        const wanted = attrsById[id] || [];
        // valori degli attributi richiesti
        const atPairs = wanted.map(name => {
            const n = JSON.stringify(name);
            return `${n}: state_attr(${e}, ${n})`;
        }).join(", ");
        return `${e}: {` +
            `"s": states(${e}), ` +
            `"t": state_translated(${e}), ` +
            `"u": state_attr(${e}, "unit_of_measurement"), ` +
            `"dc": state_attr(${e}, "device_class"), ` +
            `"ic": state_attr(${e}, "icon"), ` +
            `"bl": state_attr(${e}, "battery_level"), ` +
            `"ch": (state_attr(${e}, "battery_charging") or state_attr(${e}, "is_charging") or state_attr(${e}, "charging")), ` +
            `"an": (states[${e}].attributes.keys() | list), ` +
            `"at": {${atPairs}}` +
        `}`;
    });
    return `{{ {${parts.join(", ")}} | to_json }}`;
}

/*
 * Formatta una data/ora secondo un pattern semplice (stile moment/day.js ridotto).
 * Token: YYYY YY MM M DD D HH H mm m ss s  + MMM MMMM (mese testuale) + dddd ddd (giorno).
 * Se il valore non e' una data/ora valida, ritorna il valore originale invariato.
 * localeArg: "it" | "en" (per nomi mese/giorno). Default "it".
 */
const MONTHS = {
    it: ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"],
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"]
};
const DAYS = {
    it: ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"],
    en: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
};
function formatDate(value, pattern, localeArg) {
    if (!pattern || value == null || value === "") return value;
    // accetta ISO date/datetime; se non parseabile, lascia invariato
    const str = String(value);
    // evita di interpretare numeri puri (es. "23") come date
    if (/^-?\d+(\.\d+)?$/.test(str.trim())) return value;
    const d = new Date(str);
    if (isNaN(d.getTime())) return value;
    const loc = (localeArg === "en") ? "en" : "it";
    const pad = (n, l = 2) => String(n).padStart(l, "0");
    const map = {
        YYYY: d.getFullYear(),
        YY: pad(d.getFullYear() % 100),
        MMMM: MONTHS[loc][d.getMonth()],
        MMM: MONTHS[loc][d.getMonth()].slice(0, 3),
        MM: pad(d.getMonth() + 1),
        M: d.getMonth() + 1,
        DDDD: DAYS[loc][d.getDay()],
        dddd: DAYS[loc][d.getDay()],
        ddd: DAYS[loc][d.getDay()].slice(0, 3),
        DD: pad(d.getDate()),
        D: d.getDate(),
        HH: pad(d.getHours()),
        H: d.getHours(),
        mm: pad(d.getMinutes()),
        m: d.getMinutes(),
        ss: pad(d.getSeconds()),
        s: d.getSeconds(),
    };
    // sostituisci i token dal piu' lungo al piu' corto per evitare collisioni
    const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
    let out = pattern;
    // uso placeholder per non ri-sostituire caratteri gia' inseriti
    const holders = [];
    tokens.forEach((tk) => {
        out = out.replace(new RegExp(tk, "g"), () => {
            holders.push(String(map[tk]));
            return "\u0000" + (holders.length - 1) + "\u0000";
        });
    });
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => holders[Number(i)]);
    return out;
}

module.exports = { iconForEntity, colorForEntity, buildTemplate, formatDate };
