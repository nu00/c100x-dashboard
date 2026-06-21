/* C100X Dashboard — editor (v0.8.2) — IT/EN */

/* ---------- i18n ---------- */
const I18N = {
  it: {
    ph_layout_name: "nome layout", save: "Salva", load_layout: "— carica layout —", delete: "Elimina",
    t_delete_loaded: "Elimina il layout caricato", new: "Nuovo", set_active: "Imposta attiva",
    t_set_active: "Imposta come schermata mostrata sul citofono", t_duration: "durata in secondi (0 = resta)",
    show_now: "Mostra ora", t_show_now: "Mostra subito la scheda sul citofono", intercom: "Citofono",
    t_intercom: "Installa sul citofono via SSH", add: "Aggiungi", el_text: "Testo", el_entity: "Valore sensore",
    el_image: "Immagine", el_icon: "Icona", el_rect: "Rettangolo", el_circle: "Cerchio", el_triangle: "Triangolo",
    el_line: "Linea", el_arrow: "Freccia", background: "Sfondo", color: "Colore", grid: "Griglia",
    snap: "Aggancia (10px)", palette_hint: "Trascina per spostare. Maniglia in basso a destra per ridimensionare. Canc per eliminare.",
    properties: "Proprietà", select_element: "Seleziona un elemento sulla tela.",
    m_title: "Citofono — installazione via SSH",
    m_hint: "Carica la pagina sul citofono, applica la patch e riavvia. Richiede SSH attivo sul citofono. Viene salvato un backup di main.qml.",
    m_host: "Host / IP del citofono", m_port: "Porta", m_user: "Utente", m_pass: "Password",
    m_savepass: "Salva la password nell'add-on", m_base: "URL dell'add-on (come lo vede il citofono)",
    m_advanced: "Avanzate", m_nodepath: "Percorso di node sul citofono", m_reboot: "Riavvia il citofono al termine",
    m_savebtn: "Salva impostazioni", m_install: "Installa / aggiorna sul citofono", m_close: "Chiudi",
    ready: "Pronto.", pos_size: "Posizione e dimensione", rotation_deg: "Rotazione (°)", text: "Testo", entity: "Entità",
    ph_entity: "cerca un'entità…", read_value: "Leggi valore attuale", prefix: "Prefisso", suffix: "Suffisso",
    decimals: "Decimali", image_url: "URL immagine", ph_image_url: "image/… o http://…", upload_image: "Carica immagine",
    gallery: "Galleria (caricate + HA)", icon: "Icona", ph_icon: "cerca… (MDI o in uso)", thickness: "Spessore (px)",
    hint_rotate_line: "Usa la rotazione per inclinare la linea.", hint_rotate_arrow: "Usa la rotazione per inclinare la freccia.",
    delete_element: "Elimina elemento", font_size: "Dimensione font (px)", text_color: "Colore testo", bold: "Grassetto",
    alignment: "Allineamento", align_left: "Sinistra", align_center: "Centro", align_right: "Destra", in_use: "in uso",
    added: "Aggiunto: {0}", deleted: "Elemento eliminato.", name_invalid: "Nome non valido (lettere, numeri, spazi, - _ ; max 40).",
    saved: "Salvato: {0}", save_error: "Errore nel salvataggio.", loaded: "Caricato: {0}", load_error: "Impossibile caricare.",
    layout_deleted: "Eliminato: {0}", new_layout: "Nuovo layout.", confirm_delete: 'Eliminare il layout "{0}"?',
    confirm_new: "Creare un nuovo layout? Le modifiche non salvate andranno perse.", active_set: '"{0}" è ora la schermata attiva sul citofono.',
    active_error: "Errore nell'impostare l'attiva.", ask_save_first: "Salva o carica prima un layout.",
    shown: 'Scheda "{0}" mostrata sul citofono (resta finché non cambi).', shown_dur: 'Scheda "{0}" mostrata sul citofono per {1}s.',
    show_error: "Errore nel mostrare la scheda.", upload_ok: "Immagine caricata: {0}", upload_fail: "Upload fallito: {0}",
    gallery_empty: "Nessuna immagine. Caricane una o mettile in /config/www di HA.", gallery_loading: "Carico…",
    entity_val: "Valore di {0}: {1}", entity_err: "Errore lettura entità: {0}",
    m_log_installing: "Installazione in corso… (può richiedere ~10s + riavvio)", m_log_saved: "Impostazioni salvate.",
    m_log_save_error: "Errore nel salvataggio.", m_log_neterr: "Errore di rete: {0}", m_ssh_unavail: "Attenzione: il modulo SSH non è disponibile in questa build dell'add-on.",
    ph_pass_saved: "(password salvata — lascia vuoto)", ph_pass: "password SSH", set_entity: "Entità: {0}", img_set: "Immagine: {0}"
  },
  en: {
    ph_layout_name: "layout name", save: "Save", load_layout: "— load layout —", delete: "Delete",
    t_delete_loaded: "Delete the loaded layout", new: "New", set_active: "Set active",
    t_set_active: "Set as the screen shown on the intercom", t_duration: "duration in seconds (0 = stays)",
    show_now: "Show now", t_show_now: "Show the card on the intercom now", intercom: "Intercom",
    t_intercom: "Install on the intercom via SSH", add: "Add", el_text: "Text", el_entity: "Sensor value",
    el_image: "Image", el_icon: "Icon", el_rect: "Rectangle", el_circle: "Circle", el_triangle: "Triangle",
    el_line: "Line", el_arrow: "Arrow", background: "Background", color: "Color", grid: "Grid",
    snap: "Snap (10px)", palette_hint: "Drag to move. Bottom-right handle to resize. Del to remove.",
    properties: "Properties", select_element: "Select an element on the canvas.",
    m_title: "Intercom — install via SSH",
    m_hint: "Uploads the page to the intercom, patches it and reboots. Requires SSH enabled on the intercom. A backup of main.qml is saved.",
    m_host: "Intercom host / IP", m_port: "Port", m_user: "User", m_pass: "Password",
    m_savepass: "Save the password in the add-on", m_base: "Add-on URL (as the intercom sees it)",
    m_advanced: "Advanced", m_nodepath: "node path on the intercom", m_reboot: "Reboot the intercom when done",
    m_savebtn: "Save settings", m_install: "Install / update on the intercom", m_close: "Close",
    ready: "Ready.", pos_size: "Position and size", rotation_deg: "Rotation (°)", text: "Text", entity: "Entity",
    ph_entity: "search an entity…", read_value: "Read current value", prefix: "Prefix", suffix: "Suffix",
    decimals: "Decimals", image_url: "Image URL", ph_image_url: "image/… or http://…", upload_image: "Upload image",
    gallery: "Gallery (uploaded + HA)", icon: "Icon", ph_icon: "search… (MDI or in use)", thickness: "Thickness (px)",
    hint_rotate_line: "Use rotation to tilt the line.", hint_rotate_arrow: "Use rotation to tilt the arrow.",
    delete_element: "Delete element", font_size: "Font size (px)", text_color: "Text color", bold: "Bold",
    alignment: "Alignment", align_left: "Left", align_center: "Center", align_right: "Right", in_use: "in use",
    added: "Added: {0}", deleted: "Element deleted.", name_invalid: "Invalid name (letters, numbers, spaces, - _ ; max 40).",
    saved: "Saved: {0}", save_error: "Save failed.", loaded: "Loaded: {0}", load_error: "Could not load.",
    layout_deleted: "Deleted: {0}", new_layout: "New layout.", confirm_delete: 'Delete layout "{0}"?',
    confirm_new: "Create a new layout? Unsaved changes will be lost.", active_set: '"{0}" is now the active screen on the intercom.',
    active_error: "Could not set the active layout.", ask_save_first: "Save or load a layout first.",
    shown: 'Card "{0}" shown on the intercom (stays until changed).', shown_dur: 'Card "{0}" shown on the intercom for {1}s.',
    show_error: "Could not show the card.", upload_ok: "Image uploaded: {0}", upload_fail: "Upload failed: {0}",
    gallery_empty: "No images. Upload one or put them in HA's /config/www.", gallery_loading: "Loading…",
    entity_val: "Value of {0}: {1}", entity_err: "Entity read error: {0}",
    m_log_installing: "Installing… (may take ~10s + reboot)", m_log_saved: "Settings saved.",
    m_log_save_error: "Save failed.", m_log_neterr: "Network error: {0}", m_ssh_unavail: "Warning: the SSH module is not available in this add-on build.",
    ph_pass_saved: "(password saved — leave empty)", ph_pass: "SSH password", set_entity: "Entity: {0}", img_set: "Image: {0}"
  }
};
let LANG = (localStorage.getItem("cs_lang") || (navigator.language || "it").slice(0, 2).toLowerCase());
if (!I18N[LANG]) LANG = "en";
function t(k) {
  let s = (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
  for (let i = 1; i < arguments.length; i++) s = s.replace("{" + (i - 1) + "}", arguments[i]);
  return s;
}
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
  document.querySelectorAll("[data-i18n-title]").forEach(el => el.title = t(el.dataset.i18nTitle));
}

const SCREEN_W = 800, SCREEN_H = 480;
const GRID = 10;

let layout = newLayout();
let selectedId = null;
let scale = 1;
let ENTITIES = [];
let ENTITY_ICONS = [];

function newLayout() { return { name: "", background: "#000000", elements: [] }; }
function uid() { return "el_" + Math.random().toString(36).slice(2, 8); }

function defaultsFor(type) {
  const base = { id: uid(), type, x: 40, y: 40, w: 200, h: 60, rotation: 0 };
  switch (type) {
    case "text":     return { ...base, text: "Testo", fontSize: 32, color: "#ffffff", bold: true, align: "left" };
    case "entity":   return { ...base, entity: "", prefix: "", suffix: "", decimals: 0, fontSize: 40, color: "#ffffff", bold: true, align: "left" };
    case "image":    return { ...base, url: "", w: 160, h: 120 };
    case "icon":     return { ...base, icon: "information-outline", color: "#ffffff", w: 80, h: 80 };
    case "rect":     return { ...base, fill: "#f2a93b" };
    case "circle":   return { ...base, w: 120, h: 120, fill: "#f2a93b" };
    case "triangle": return { ...base, w: 120, h: 120, fill: "#f2a93b" };
    case "line":     return { ...base, w: 240, h: 30, thickness: 6, fill: "#f2a93b" };
    case "arrow":    return { ...base, w: 240, h: 40, thickness: 6, fill: "#f2a93b" };
  }
  return base;
}

const screenEl = document.getElementById("screen");
const stageWrap = document.getElementById("stageWrap");
const stageArea = document.getElementById("stageArea");
const propsBody = document.getElementById("propsBody");
const statusMsg = document.getElementById("statusMsg");
const layoutNameInput = document.getElementById("layoutName");
const layoutList = document.getElementById("layoutList");
const bgColor = document.getElementById("bgColor");
const snapChk = document.getElementById("snap");

function setStatus(m) { statusMsg.textContent = m; }
function snap(v) { return snapChk.checked ? Math.round(v / GRID) * GRID : Math.round(v); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function selected() { return layout.elements.find(e => e.id === selectedId) || null; }
function nodeById(id) { return screenEl.querySelector('.el[data-id="' + id + '"]'); }
function iconUrl(name, color) { return "icon/" + encodeURIComponent(name) + "?color=" + encodeURIComponent(String(color || "#ffffff").replace("#", "")); }

function fitScale() {
  const avail = stageArea.clientWidth - 40;
  scale = Math.min(1, avail / SCREEN_W);
  stageWrap.style.transform = `scale(${scale})`;
  stageWrap.style.width = SCREEN_W + "px";
  stageWrap.style.height = SCREEN_H + "px";
  stageWrap.style.marginBottom = (SCREEN_H * (1 - scale)) * -1 + "px";
}
window.addEventListener("resize", fitScale);

function render() {
  screenEl.style.background = layout.background || "#000";
  bgColor.value = layout.background || "#000000";
  screenEl.innerHTML = "";
  guideV = guideH = null;
  for (const el of layout.elements) screenEl.appendChild(buildNode(el));
}

function applyTextStyle(t2, el) {
  t2.style.width = "100%"; t2.style.height = "100%";
  t2.style.color = el.color; t2.style.fontSize = el.fontSize + "px";
  t2.style.fontWeight = el.bold ? "700" : "400";
  t2.style.justifyContent = el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start";
}

function buildNode(el) {
  const d = document.createElement("div");
  d.className = "el" + (el.id === selectedId ? " selected" : "");
  d.dataset.id = el.id;
  d.style.left = el.x + "px"; d.style.top = el.y + "px";
  d.style.width = el.w + "px"; d.style.height = el.h + "px";
  if (el.rotation) d.style.transform = "rotate(" + el.rotation + "deg)";

  if (el.type === "text" || el.type === "entity") {
    const t2 = document.createElement("div"); t2.className = "el-text"; applyTextStyle(t2, el); t2.textContent = displayText(el); d.appendChild(t2);
  } else if (el.type === "image") {
    if (el.url) { const img = document.createElement("img"); img.className = "el-img"; img.src = el.url; d.appendChild(img); } else d.appendChild(ph(t("el_image")));
  } else if (el.type === "icon") {
    if (el.icon) { const img = document.createElement("img"); img.className = "el-img"; img.src = iconUrl(el.icon, el.color); d.appendChild(img); } else d.appendChild(ph(t("el_icon")));
  } else if (el.type === "rect" || el.type === "circle" || el.type === "triangle") {
    const s = document.createElement("div"); s.className = "el-shape"; s.style.background = el.fill;
    if (el.type === "circle") s.style.borderRadius = "50%";
    if (el.type === "triangle") s.style.clipPath = "polygon(50% 0, 100% 100%, 0 100%)";
    d.appendChild(s);
  } else if (el.type === "line" || el.type === "arrow") {
    const shaft = document.createElement("div"); shaft.className = "line-shaft";
    shaft.style.background = el.fill; shaft.style.height = (el.thickness || 6) + "px";
    if (el.type === "arrow") shaft.style.right = (el.thickness || 6) * 2 + "px";
    d.appendChild(shaft);
    if (el.type === "arrow") {
      const head = document.createElement("div"); head.className = "arrow-head";
      const tk = el.thickness || 6;
      head.style.borderTopWidth = head.style.borderBottomWidth = (tk * 1.8) + "px";
      head.style.borderLeftWidth = (tk * 2.4) + "px"; head.style.borderLeftColor = el.fill;
      d.appendChild(head);
    }
  }

  const h = document.createElement("div"); h.className = "handle"; d.appendChild(h);
  const rh = document.createElement("div"); rh.className = "rot-handle"; d.appendChild(rh);
  d.addEventListener("pointerdown", (e) => onElementPointerDown(e, el, d, h, rh));
  return d;
}
function ph(label) { const p = document.createElement("div"); p.className = "el-shape el-ph"; p.textContent = label; return p; }

function displayText(el) {
  if (el.type === "text") return el.text || "";
  let v = (el._preview !== undefined && el._preview !== null) ? el._preview : "—";
  if (!isNaN(parseFloat(v)) && isFinite(v)) v = parseFloat(v).toFixed(el.decimals || 0);
  return (el.prefix || "") + v + (el.suffix || "");
}

const COMPLEX = new Set(["image", "icon", "line", "arrow"]);
function refreshSelectedNode() {
  const el = selected(); if (!el) return;
  let node = nodeById(el.id); if (!node) { render(); return; }
  if (COMPLEX.has(el.type)) { render(); return; }
  node.style.left = el.x + "px"; node.style.top = el.y + "px";
  node.style.width = el.w + "px"; node.style.height = el.h + "px";
  node.style.transform = el.rotation ? "rotate(" + el.rotation + "deg)" : "";
  const inner = node.firstChild;
  if (el.type === "text" || el.type === "entity") { applyTextStyle(inner, el); inner.textContent = displayText(el); }
  else if (el.type === "rect" || el.type === "circle" || el.type === "triangle") inner.style.background = el.fill;
}

/* guide di allineamento */
let guideV = null, guideH = null;
function showGuide(axis, pos, kind) {
  let g = axis === "v" ? guideV : guideH;
  if (!g || !g.isConnected) { g = document.createElement("div"); screenEl.appendChild(g); if (axis === "v") guideV = g; else guideH = g; }
  g.className = "guide guide-" + axis + " guide-" + (kind || "edge");
  if (axis === "v") g.style.left = pos + "px"; else g.style.top = pos + "px";
  g.style.display = "block";
}
function hideGuides() { if (guideV) guideV.style.display = "none"; if (guideH) guideH.style.display = "none"; }
function buildTargets(skip, xT, yT) {
  xT.push({ p: 0, k: "edge" }, { p: SCREEN_W / 2, k: "center" }, { p: SCREEN_W, k: "edge" });
  yT.push({ p: 0, k: "edge" }, { p: SCREEN_H / 2, k: "center" }, { p: SCREEN_H, k: "edge" });
  for (const o of layout.elements) {
    if (o.id === skip.id) continue;
    xT.push({ p: o.x, k: "edge" }, { p: o.x + o.w / 2, k: "center" }, { p: o.x + o.w, k: "edge" });
    yT.push({ p: o.y, k: "edge" }, { p: o.y + o.h / 2, k: "center" }, { p: o.y + o.h, k: "edge" });
  }
}

function onElementPointerDown(e, el, node, handle, rotHandle) {
  if (e.button !== 0) return;
  e.preventDefault();
  if (selectedId !== el.id) selectElement(el.id);
  const mode = e.target === rotHandle ? "rotate" : (e.target === handle ? "resize" : "move");
  try { node.setPointerCapture(e.pointerId); } catch (_) {}
  const startMX = e.clientX, startMY = e.clientY;
  const start = { x: el.x, y: el.y, w: el.w, h: el.h };
  let cx = 0, cy = 0;
  if (mode === "rotate") { const r = node.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const xT = [], yT = [];
  if (mode === "move") buildTargets(el, xT, yT);
  let raf = 0, pending = null;
  node.classList.add("dragging");

  function apply() {
    raf = 0; if (!pending) return;
    if (mode === "rotate") {
      let a = Math.round(Math.atan2(pending.my - cy, pending.mx - cx) * 180 / Math.PI + 90);
      if (snapChk.checked) a = Math.round(a / 15) * 15;
      a = ((a % 360) + 360) % 360; if (a > 180) a -= 360;
      el.rotation = a; node.style.transform = "rotate(" + a + "deg)";
      const rf = document.getElementById("p_rot"); if (rf) rf.value = a;
      return;
    }
    const dx = (pending.mx - startMX) / scale, dy = (pending.my - startMY) / scale;
    if (mode === "resize") {
      el.w = clamp(snap(start.w + dx), 8, SCREEN_W); el.h = clamp(snap(start.h + dy), 8, SCREEN_H);
      node.style.width = el.w + "px"; node.style.height = el.h + "px";
      return;
    }
    let nx = clamp(snap(start.x + dx), 0, SCREEN_W - el.w);
    let ny = clamp(snap(start.y + dy), 0, SCREEN_H - el.h);
    const TOL = 6;
    let bx = { d: TOL + 1 };
    [[0], [el.w / 2], [el.w]].forEach(([off]) => { const a = nx + off; for (const tg of xT) { const dd = Math.abs(a - tg.p); if (dd < bx.d) bx = { d: dd, off, t: tg }; } });
    let gv = null; if (bx.t) { nx = clamp(bx.t.p - bx.off, 0, SCREEN_W - el.w); gv = bx.t; }
    let by = { d: TOL + 1 };
    [[0], [el.h / 2], [el.h]].forEach(([off]) => { const a = ny + off; for (const tg of yT) { const dd = Math.abs(a - tg.p); if (dd < by.d) by = { d: dd, off, t: tg }; } });
    let gh = null; if (by.t) { ny = clamp(by.t.p - by.off, 0, SCREEN_H - el.h); gh = by.t; }
    el.x = nx; el.y = ny;
    node.style.left = nx + "px"; node.style.top = ny + "px";
    if (gv) showGuide("v", gv.p, gv.k); else if (guideV) guideV.style.display = "none";
    if (gh) showGuide("h", gh.p, gh.k); else if (guideH) guideH.style.display = "none";
  }
  function onMove(ev) { pending = { mx: ev.clientX, my: ev.clientY }; if (!raf) raf = requestAnimationFrame(apply); }
  function onUp() {
    try { node.releasePointerCapture(e.pointerId); } catch (_) {}
    node.classList.remove("dragging");
    node.removeEventListener("pointermove", onMove); node.removeEventListener("pointerup", onUp);
    if (raf) cancelAnimationFrame(raf); apply(); hideGuides(); syncGeometryFields(el);
  }
  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerup", onUp);
}

screenEl.addEventListener("pointerdown", (e) => { if (e.target === screenEl) selectElement(null); });
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement.tagName;
  if ((e.key === "Delete" || e.key === "Backspace") && selectedId && tag !== "INPUT" && tag !== "TEXTAREA") deleteSelected();
});

function selectElement(id) {
  selectedId = id;
  screenEl.querySelectorAll(".el").forEach(n => n.classList.toggle("selected", n.dataset.id === id));
  renderProps();
}
function deleteSelected() {
  if (!selectedId) return;
  layout.elements = layout.elements.filter(e => e.id !== selectedId);
  selectedId = null; render(); renderProps(); setStatus(t("deleted"));
}

function field(label, inputHtml) { return `<div class="field"><label>${label}</label>${inputHtml}</div>`; }

function renderProps() {
  const el = selected();
  if (!el) { propsBody.innerHTML = `<p class="hint">${t("select_element")}</p>`; return; }

  let html = `<div class="field"><label>${t("pos_size")}</label>
    <div class="row-2"><input id="p_x" type="number" value="${el.x}" title="X"><input id="p_y" type="number" value="${el.y}" title="Y"></div>
    <div class="row-2" style="margin-top:.4rem"><input id="p_w" type="number" value="${el.w}" title="W"><input id="p_h" type="number" value="${el.h}" title="H"></div></div>`;
  html += field(t("rotation_deg"), `<input id="p_rot" type="number" min="-180" max="180" value="${el.rotation || 0}">`);

  if (el.type === "text") {
    html += field(t("text"), `<textarea id="p_text">${escapeHtml(el.text)}</textarea>`) + textStyleFields(el);
  } else if (el.type === "entity") {
    html += field(t("entity"), `<div class="ta-wrap"><input id="p_entity" type="text" placeholder="${t("ph_entity")}" value="${escapeHtml(el.entity)}" autocomplete="off"></div>`);
    html += `<button id="p_read" style="width:100%;margin-bottom:.5rem">${t("read_value")}</button>`;
    html += `<div class="prop-preview" id="p_preview">${escapeHtml(displayText(el))}</div>`;
    html += `<div class="field inline"><div>${field(t("prefix"), `<input id="p_prefix" type="text" value="${escapeHtml(el.prefix)}">`)}</div><div>${field(t("suffix"), `<input id="p_suffix" type="text" value="${escapeHtml(el.suffix)}">`)}</div></div>`;
    html += field(t("decimals"), `<input id="p_decimals" type="number" min="0" max="4" value="${el.decimals || 0}">`) + textStyleFields(el);
  } else if (el.type === "image") {
    html += field(t("image_url"), `<input id="p_url" type="text" placeholder="${t("ph_image_url")}" value="${escapeHtml(el.url)}">`);
    html += `<label class="upload-btn">${t("upload_image")}<input id="p_file" type="file" accept="image/*" hidden></label>`;
    html += `<button id="p_gallery" style="width:100%;margin-top:.4rem">${t("gallery")}</button>`;
    html += `<div id="p_thumbs" class="thumbs"></div>`;
  } else if (el.type === "icon") {
    html += field(t("icon"), `<div class="ta-wrap"><input id="p_icon" type="text" placeholder="${t("ph_icon")}" value="${escapeHtml(el.icon)}" autocomplete="off"></div>`);
    html += field(t("color"), `<input id="p_color2" type="color" value="${el.color}">`);
  } else if (el.type === "rect" || el.type === "circle" || el.type === "triangle") {
    html += field(t("color"), `<input id="p_fill" type="color" value="${el.fill}">`);
  } else if (el.type === "line" || el.type === "arrow") {
    html += field(t("thickness"), `<input id="p_thick" type="number" min="1" max="100" value="${el.thickness || 6}">`);
    html += field(t("color"), `<input id="p_fill" type="color" value="${el.fill}">`);
    html += `<p class="hint">${el.type === "arrow" ? t("hint_rotate_arrow") : t("hint_rotate_line")}</p>`;
  }

  html += `<button class="danger" id="p_delete">${t("delete_element")}</button>`;
  propsBody.innerHTML = html;
  wireProps(el);
}

function textStyleFields(el) {
  return field(t("font_size"), `<input id="p_fontSize" type="number" min="8" max="200" value="${el.fontSize}">`)
    + field(t("text_color"), `<input id="p_color" type="color" value="${el.color}">`)
    + `<div class="toggle-row"><label><input id="p_bold" type="checkbox" ${el.bold ? "checked" : ""}> ${t("bold")}</label></div>`
    + field(t("alignment"), `<select id="p_align"><option value="left" ${el.align==="left"?"selected":""}>${t("align_left")}</option><option value="center" ${el.align==="center"?"selected":""}>${t("align_center")}</option><option value="right" ${el.align==="right"?"selected":""}>${t("align_right")}</option></select>`);
}

function syncGeometryFields(el) {
  if (!selected() || selected().id !== el.id) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set("p_x", el.x); set("p_y", el.y); set("p_w", el.w); set("p_h", el.h);
}

function wireProps(el) {
  const bind = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener("input", () => { fn(e); refreshSelectedNode(); }); };
  bind("p_x", e => el.x = clamp(parseInt(e.value) || 0, 0, SCREEN_W - el.w));
  bind("p_y", e => el.y = clamp(parseInt(e.value) || 0, 0, SCREEN_H - el.h));
  bind("p_w", e => el.w = clamp(parseInt(e.value) || 8, 8, SCREEN_W));
  bind("p_h", e => el.h = clamp(parseInt(e.value) || 8, 8, SCREEN_H));
  bind("p_rot", e => el.rotation = clamp(parseInt(e.value) || 0, -180, 180));
  bind("p_text", e => el.text = e.value);
  bind("p_prefix", e => el.prefix = e.value);
  bind("p_suffix", e => el.suffix = e.value);
  bind("p_decimals", e => el.decimals = clamp(parseInt(e.value) || 0, 0, 4));
  bind("p_url", e => el.url = e.value.trim());
  bind("p_fill", e => el.fill = e.value);
  bind("p_thick", e => el.thickness = clamp(parseInt(e.value) || 1, 1, 100));
  bind("p_fontSize", e => el.fontSize = clamp(parseInt(e.value) || 8, 8, 200));
  bind("p_color", e => el.color = e.value);

  const boldEl = document.getElementById("p_bold");
  if (boldEl) boldEl.addEventListener("change", () => { el.bold = boldEl.checked; refreshSelectedNode(); });
  const alignEl = document.getElementById("p_align");
  if (alignEl) alignEl.addEventListener("change", () => { el.align = alignEl.value; refreshSelectedNode(); });
  const color2 = document.getElementById("p_color2");
  if (color2) color2.addEventListener("input", () => { el.color = color2.value; render(); });

  const del = document.getElementById("p_delete");
  if (del) del.addEventListener("click", deleteSelected);
  const read = document.getElementById("p_read");
  if (read) read.addEventListener("click", () => previewEntity(el));

  const entInput = document.getElementById("p_entity");
  if (entInput) attachTypeahead(entInput, q => suggestEntities(q), val => { el.entity = val; setStatus(t("set_entity", val)); previewEntity(el); });
  const icoInput = document.getElementById("p_icon");
  if (icoInput) attachTypeahead(icoInput, q => suggestIcons(q), val => { el.icon = val; render(); });

  const file = document.getElementById("p_file");
  if (file) file.addEventListener("change", () => uploadImage(file.files[0], el));
  const gal = document.getElementById("p_gallery");
  if (gal) gal.addEventListener("click", () => toggleGallery(el));
}

function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function attachTypeahead(input, suggestFn, onPick) {
  const wrap = input.parentNode;
  let list = null, items = [], active = -1, tm = 0;
  function close() { if (list) { list.remove(); list = null; } active = -1; }
  function open(results) {
    close(); if (!results.length) return;
    items = results; list = document.createElement("div"); list.className = "ta-list";
    results.forEach((r, i) => {
      const it = document.createElement("div"); it.className = "ta-item";
      it.innerHTML = `<span>${escapeHtml(r.value)}</span>` + (r.label ? `<span class="muted">${escapeHtml(r.label)}</span>` : "");
      it.addEventListener("mousedown", (ev) => { ev.preventDefault(); pick(i); });
      list.appendChild(it);
    });
    wrap.appendChild(list);
  }
  function pick(i) { const r = items[i]; if (!r) return; input.value = r.value; close(); onPick(r.value); }
  function hl() { if (list) [...list.children].forEach((c, i) => c.classList.toggle("active", i === active)); }
  input.addEventListener("input", () => {
    const q = input.value.trim(); onPick(q);
    clearTimeout(tm); tm = setTimeout(async () => { try { open(await suggestFn(q)); } catch { close(); } }, 120);
  });
  input.addEventListener("keydown", (e) => {
    if (!list) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); hl(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); hl(); }
    else if (e.key === "Enter") { if (active >= 0) { e.preventDefault(); pick(active); } }
    else if (e.key === "Escape") close();
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

function suggestEntities(q) {
  q = q.toLowerCase();
  const f = q ? ENTITIES.filter(e => e.id.toLowerCase().includes(q) || (e.name || "").toLowerCase().includes(q)) : ENTITIES;
  return f.slice(0, 30).map(e => ({ value: e.id, label: e.name }));
}
async function suggestIcons(q) {
  if (!q) return [];
  const used = ENTITY_ICONS.filter(n => n.includes(q.toLowerCase())).slice(0, 8).map(n => ({ value: n, label: t("in_use") }));
  let mdi = [];
  try { mdi = (await (await fetch("api/icons?q=" + encodeURIComponent(q))).json()).map(i => ({ value: i.name, label: "" })); } catch {}
  const seen = new Set(used.map(u => u.value));
  return used.concat(mdi.filter(m => !seen.has(m.value))).slice(0, 40);
}

async function previewEntity(el) {
  if (!el.entity) return;
  try {
    const r = await fetch("api/state/" + encodeURIComponent(el.entity));
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
    el._preview = data.state; refreshSelectedNode();
    const pv = document.getElementById("p_preview"); if (pv) pv.textContent = displayText(el);
    setStatus(t("entity_val", el.entity, data.state));
  } catch (e) { setStatus(t("entity_err", e.message)); }
}

function uploadImage(file, el) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const name = file.name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 80);
    try {
      const r = await fetch("api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, data: reader.result }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      el.url = d.url; render(); setStatus(t("upload_ok", name));
      const u = document.getElementById("p_url"); if (u) u.value = el.url;
    } catch (e) { setStatus(t("upload_fail", e.message)); }
  };
  reader.readAsDataURL(file);
}

async function toggleGallery(el) {
  const box = document.getElementById("p_thumbs");
  if (!box) return;
  if (box.childElementCount) { box.innerHTML = ""; return; }
  box.innerHTML = `<p class="hint">${t("gallery_loading")}</p>`;
  try {
    const [imgs, ha] = await Promise.all([
      fetch("api/images").then(r => r.json()).catch(() => []),
      fetch("api/ha-images").then(r => r.json()).catch(() => [])
    ]);
    const all = [...imgs, ...ha];
    if (!all.length) { box.innerHTML = `<p class="hint">${t("gallery_empty")}</p>`; return; }
    box.innerHTML = "";
    for (const it of all) {
      const tb = document.createElement("img"); tb.className = "thumb"; tb.src = it.url; tb.title = it.name;
      tb.addEventListener("click", () => { el.url = it.url; render(); const u = document.getElementById("p_url"); if (u) u.value = el.url; setStatus(t("img_set", it.name)); });
      box.appendChild(tb);
    }
  } catch (e) { box.innerHTML = `<p class="hint">${escapeHtml(e.message)}</p>`; }
}

document.querySelectorAll("button[data-add]").forEach(b => {
  b.addEventListener("click", () => {
    const el = defaultsFor(b.dataset.add);
    layout.elements.push(el); render(); selectElement(el.id); setStatus(t("added", t("el_" + b.dataset.add)));
  });
});
bgColor.addEventListener("input", () => { layout.background = bgColor.value; screenEl.style.background = bgColor.value; });

async function refreshLayoutList() {
  try {
    const data = await (await fetch("api/layouts")).json();
    const cur = layoutList.value;
    layoutList.innerHTML = `<option value="">${t("load_layout")}</option>` + data.layouts.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    layoutList.value = cur;
  } catch {}
}
function stripPreview(el) { const c = { ...el }; delete c._preview; return c; }

document.getElementById("btnSave").addEventListener("click", async () => {
  const name = layoutNameInput.value.trim();
  if (!/^[A-Za-z0-9 _-]{1,40}$/.test(name)) { setStatus(t("name_invalid")); return; }
  const body = { name, background: layout.background, elements: layout.elements.map(stripPreview) };
  const r = await fetch("api/layouts/" + encodeURIComponent(name), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.ok) { layout.name = name; setStatus(t("saved", name)); refreshLayoutList(); } else setStatus(t("save_error"));
});
layoutList.addEventListener("change", async () => {
  const name = layoutList.value; if (!name) return;
  const r = await fetch("api/layouts/" + encodeURIComponent(name));
  if (!r.ok) { setStatus(t("load_error")); return; }
  layout = await r.json();
  if (!layout.elements) layout.elements = [];
  if (!layout.background) layout.background = "#000000";
  layoutNameInput.value = layout.name || name; selectedId = null; render(); renderProps(); setStatus(t("loaded", name));
});
document.getElementById("btnDelete").addEventListener("click", async () => {
  const name = layoutNameInput.value.trim(); if (!name) return;
  if (!confirm(t("confirm_delete", name))) return;
  await fetch("api/layouts/" + encodeURIComponent(name), { method: "DELETE" });
  setStatus(t("layout_deleted", name)); refreshLayoutList();
});
document.getElementById("btnNew").addEventListener("click", () => {
  if (layout.elements.length && !confirm(t("confirm_new"))) return;
  layout = newLayout(); selectedId = null; layoutNameInput.value = ""; layoutList.value = ""; render(); renderProps(); setStatus(t("new_layout"));
});
document.getElementById("btnSetActive").addEventListener("click", async () => {
  const name = layoutNameInput.value.trim();
  if (!name) { setStatus(t("ask_save_first")); return; }
  const r = await fetch("api/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (r.ok) setStatus(t("active_set", name)); else setStatus(t("active_error"));
});
document.getElementById("btnShow").addEventListener("click", async () => {
  const name = layoutNameInput.value.trim();
  if (!name) { setStatus(t("ask_save_first")); return; }
  const dur = parseInt(document.getElementById("showDur").value) || 0;
  await fetch("api/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  const r = await fetch("api/show", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duration: dur }) });
  if (r.ok) setStatus(dur ? t("shown_dur", name, dur) : t("shown", name)); else setStatus(t("show_error"));
});

/* modal Citofono (SSH) */
const citoModal = document.getElementById("citoModal");
function openCito() {
  fetch("api/citofono/settings").then(r => r.json()).then(c => {
    document.getElementById("cf_host").value = c.host || "";
    document.getElementById("cf_port").value = c.port || 22;
    document.getElementById("cf_user").value = c.username || "root";
    document.getElementById("cf_base").value = c.addonBase || "";
    document.getElementById("cf_node").value = c.nodePath || "/home/bticino/cfg/extra/node/bin/node";
    document.getElementById("cf_save").checked = !!c.savePassword;
    document.getElementById("cf_pass").placeholder = c.hasPassword ? t("ph_pass_saved") : t("ph_pass");
    const log = document.getElementById("cf_log"); log.hidden = true; log.textContent = "";
    if (!c.sshAvailable) setCitoLog(t("m_ssh_unavail"));
  }).catch(() => {});
  citoModal.hidden = false;
}
function closeCito() { citoModal.hidden = true; }
function setCitoLog(text) { const l = document.getElementById("cf_log"); l.hidden = false; l.textContent = text; }
function citoBody() {
  return {
    host: document.getElementById("cf_host").value.trim(),
    port: parseInt(document.getElementById("cf_port").value) || 22,
    username: document.getElementById("cf_user").value.trim(),
    password: document.getElementById("cf_pass").value,
    addonBase: document.getElementById("cf_base").value.trim(),
    nodePath: document.getElementById("cf_node").value.trim(),
    savePassword: document.getElementById("cf_save").checked,
    reboot: document.getElementById("cf_reboot").checked
  };
}
document.getElementById("btnCito").addEventListener("click", openCito);
document.getElementById("cf_close").addEventListener("click", closeCito);
citoModal.addEventListener("click", (e) => { if (e.target === citoModal) closeCito(); });
document.getElementById("cf_savebtn").addEventListener("click", async () => {
  const r = await fetch("api/citofono/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(citoBody()) });
  setCitoLog(r.ok ? t("m_log_saved") : t("m_log_save_error"));
});
document.getElementById("cf_install").addEventListener("click", async () => {
  const btn = document.getElementById("cf_install");
  btn.disabled = true; setCitoLog(t("m_log_installing"));
  await fetch("api/citofono/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(citoBody()) }).catch(() => {});
  try {
    const r = await fetch("api/citofono/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(citoBody()) });
    const d = await r.json();
    const lines = (d.log || []).slice();
    if (!d.ok && d.error && lines.indexOf("ERRORE: " + d.error) < 0) lines.push("ERRORE: " + d.error);
    setCitoLog(lines.join("\n") || (d.ok ? "OK" : "?"));
  } catch (e) { setCitoLog(t("m_log_neterr", e.message)); }
  btn.disabled = false;
});

/* selettore lingua */
const langSel = document.getElementById("langSel");
langSel.value = LANG;
langSel.addEventListener("change", () => { localStorage.setItem("cs_lang", langSel.value); location.reload(); });

/* avvio */
async function loadEntities() {
  try { ENTITIES = await (await fetch("api/entities")).json(); if (!Array.isArray(ENTITIES)) ENTITIES = []; } catch { ENTITIES = []; }
  try { ENTITY_ICONS = await (await fetch("api/entity-icons")).json(); if (!Array.isArray(ENTITY_ICONS)) ENTITY_ICONS = []; } catch { ENTITY_ICONS = []; }
}
applyStaticI18n();
fitScale(); render(); renderProps(); refreshLayoutList(); loadEntities(); setStatus(t("ready"));
