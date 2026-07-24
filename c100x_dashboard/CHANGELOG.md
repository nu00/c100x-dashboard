# Changelog

## 0.15.0

**🇮🇹 Italiano**

- **Corretto lo spegnimento spontaneo dello schermo**: a volte il display si spegneva da solo mentre una scheda era ancora mostrata. La forzatura "resta acceso" (`ForcedNormal`) veniva applicata una sola volta, al momento in cui la scheda compariva — se qualche timeout nativo del citofono la annullava in seguito, nulla la riaffermava. Ora viene riasserita ad ogni ciclo del watcher (~1s) finche' la scheda resta effettivamente mostrata.
- **Corretta la riaccensione incoerente dall'entita' luce**: riaccendendo la retroilluminazione da `light.retroilluminazione_display` dopo uno spegnimento spontaneo, a volte ricompariva la scheda giusta, altre la schermata di default del citofono — a seconda che lo standby nativo avesse silenziosamente sostituito la nostra scheda nel frattempo. L'entita' luce ora rileva questa situazione (retroilluminazione risultava spenta + una scheda risultava ancora "in mostra") e replica lo stesso resync software gia' usato da "mostra ora" (nascondi forzato, poi mostra di nuovo), cosi' il risultato e' sempre affidabile.
- **Corretto `sensor.pagina_attiva` non aggiornato**: poteva restare bloccato sul nome dell'ultima scheda anche quando lo schermo era fisicamente spento (stesso spegnimento spontaneo di cui sopra, mai passato dal nostro "nascondi"). Ora incrocia lo stato riportato dal QML con la retroilluminazione reale letta dal sysfs: se questa e' per certo spenta, il sensore torna "idle" a prescindere da cosa pensi ancora il QML.
- **Richiede una nuova installazione via SSH** (renderer QML aggiornato, versione 22).

**🇬🇧 English**

- **Fixed the screen turning itself off spontaneously**: sometimes the display would go blank on its own while a screen was still supposed to be shown. The "stay on" override (`ForcedNormal`) was applied only once, at the moment the screen appeared — if some native intercom timeout later cancelled it, nothing reasserted it. It's now reasserted on every watcher cycle (~1s) for as long as the screen is actually being shown.
- **Fixed inconsistent behavior when turning the backlight back on from the light entity**: after a spontaneous screen-off, turning the backlight back on via `light.retroilluminazione_display` would sometimes bring back the right screen, other times the intercom's default menu — depending on whether native standby had silently replaced our screen in the meantime. The light entity now detects this situation (backlight was off + a screen was still supposedly showing) and replays the same software resync already used by "show now" (forced hide, then show again), so the result is always reliable.
- **Fixed `sensor.pagina_attiva` not updating**: it could stay stuck on the last screen's name even when the display was physically off (same spontaneous screen-off as above, never went through our own "hide"). It now cross-checks the QML-reported state against the real backlight state read from sysfs: if that's definitely off, the sensor goes back to "idle" regardless of what the QML still believes.
- **Requires a new SSH install** (updated QML renderer, version 22).

## 0.14.1

**🇮🇹 Italiano**

- **Corretto**: il framebuffer della telecamera (`fb0`) non veniva mai pulito quando si fermava la pipeline — l'ultimo fotogramma restava congelato a schermo. `fb-blit` ora gestisce i segnali di stop e pulisce il proprio rettangolo prima di uscire, come già faceva `vpu-fb-decode` (un'incoerenza tra i due, corretta).
- **Entità luce dimmerabile**: come richiesto, ora supporta la regolazione della luminosità, non solo acceso/spento.
- **Corretto un effetto collaterale serio**: spegnere la retroilluminazione dall'entità luce chiudeva la nostra scheda mostrata (passava per lo stesso meccanismo usato da "mostra/nascondi", con effetti indesiderati sullo stato interno del QML). L'entità luce ora usa un percorso dedicato che agisce **solo** sulla retroilluminazione fisica (via sysfs), senza mai toccare QML — accende, spegne e dimmera senza alcun effetto sulla scheda mostrata.
- "Mostra" ora rispetta l'ultima luminosità impostata dall'entità luce invece di forzare sempre il massimo.

**🇬🇧 English**

- **Fixed**: the camera's framebuffer (`fb0`) was never cleared when the pipeline stopped — the last frame stayed frozen on screen. `fb-blit` now handles stop signals and clears its own rectangle before exiting, matching what `vpu-fb-decode` already did (an inconsistency between the two, now fixed).
- **Dimmable light entity**: as requested, it now supports brightness adjustment, not just on/off.
- **Fixed a serious side effect**: turning off the backlight from the light entity closed our shown screen (it went through the same mechanism used by "show/hide", with unwanted effects on the QML's internal state). The light entity now uses a dedicated path that acts **only** on the physical backlight (via sysfs), never touching QML — turns on, off, and dims without any effect on the shown screen.
- "Show" now respects the last brightness level set by the light entity instead of always forcing full brightness.

## 0.14.0

**🇮🇹 Italiano**

- **Corretto un blocco della retroilluminazione**: a volte lo schermo si spegneva da solo e non si riaccendeva più, né tramite l'entità luce né mostrando una nuova scheda. Trovata la causa reale (indagine passo passo, verificata di persona): il QML riaccende lo schermo solo quando il proprio stato interno passa da "non in mostra" a "in mostra" — se questa transizione restava bloccata (schermo spento senza passare dal nostro "nascondi"), un nuovo "mostra" non bastava. In più, esiste un controllo separato del framebuffer stesso (`blank`, standard del kernel Linux), indipendente dalla retroilluminazione (`brightness`), che può restare bloccato anche quando quest'ultima sembra normale.
  - "Mostra" ora forza sempre lo sblocco del framebuffer (`blank`), e se necessario replica via software la sequenza "nascondi poi mostra" che risolve il blocco dello stato interno.
  - L'entità luce ora usa lo stesso meccanismo per accendere/spegnere in modo affidabile.
- Bump della versione di controllo del renderer sul citofono (per riflettere l'aggiornamento del bundle del controller).

**🇬🇧 English**

- **Fixed a backlight lockup**: sometimes the screen would turn itself off and never come back on, neither via the light entity nor by showing a new screen. Found the real cause (step-by-step investigation, verified in person): the QML only wakes the screen when its own internal state transitions from "not showing" to "showing" — if that transition got stuck (screen off without going through our own "hide"), a new "show" alone wasn't enough. On top of that, there's a separate framebuffer-level control (`blank`, a standard Linux kernel mechanism), independent from the backlight (`brightness`), which can get stuck even when the latter looks normal.
  - "Show" now always forces the framebuffer unblank, and when needed replicates in software the "hide then show" sequence that resolves the stuck internal state.
  - The light entity now uses the same mechanism to reliably turn on/off.
- Bumped the intercom-side renderer control version (reflecting the controller bundle update).

## 0.13.0

**🇮🇹 Italiano**

- **Nuovo elemento "Telecamera"** nell'editor: mostra lo stream di una o più `camera.*` di Home Assistant (o un URL diretto) direttamente sul display del citofono, in aree scelte e ridimensionabili.
- **Decodifica diretta, non tramite GStreamer**: dopo aver scoperto un bug noto e mai risolto in `gstreamer-imx` (il decoder non riporta correttamente i propri tempi per sorgenti live, causando blocchi periodici), il citofono ora legge **direttamente** da Home Assistant (`camera_proxy_stream`, lo stesso endpoint usato dal frontend di Lovelace) e decodifica JPEG lui stesso — un solo passaggio pesante, video fluido in tempo reale, nessun carico aggiuntivo su Home Assistant.
- **Compatibile con qualsiasi `camera.*`**, a prescindere dal codec nativo della telecamera: `camera_proxy_stream` normalizza sempre in MJPEG.
- **Multi-camera**: puoi aggiungere quante telecamere vuoi nella stessa scheda — ognuna gira in una pipeline indipendente sul citofono, senza toccarsi a vicenda.
- **URL diretto universale**: anche per un URL diretto (non un'entità HA), il codec viene rilevato automaticamente (MJPEG o H.264, quest'ultimo tramite il decoder hardware VPU — `libimxvpuapi`, libreria ufficiale Freescale/NXP già presente sul citofono).
- **RTSP**: supporto al protocollo, per telecamere IP che lo usano nativamente.
- **Rinnovo automatico del token**: il token di accesso di ogni telecamera (che HA ruota ogni ~5 minuti) viene rinfrescato in anticipo, invece di aspettare che la pipeline si blocchi.
- **Stop automatico affidabile**: la pipeline camera si ferma anche passando direttamente da una scheda all'altra, o quando lo stato reale del citofono cambia (es. una chiamata in arrivo) — non solo con un "nascondi" esplicito.
- **Vista live**: ora mostra anche `fb0` (dove scrive la telecamera) sotto `fb1` (la GUI), non solo quest'ultima — rispecchia davvero quello che si vede a schermo.
- **Aggiornamento più sicuro**: l'entità di aggiornamento ora aspetta che il citofono torni online con la versione nuova prima di considerarsi conclusa, evitando il rischio di sovrapporre due installazioni durante un riavvio.
- **Pallino di aggiornamento pendente** sul pulsante "Citofono" nell'editor.
- Sorgenti compilate incluse (`citofono/vpu-decode-src/`), con un README tecnico su perché/come, per trasparenza e futura manutenzione.

**🇬🇧 English**

- **New "Camera" element** in the editor: shows one or more Home Assistant `camera.*` streams (or a direct URL) right on the intercom's display, in chosen, resizable areas.
- **Direct decoding, not through GStreamer**: after finding a known, never-fixed bug in `gstreamer-imx` (the decoder doesn't correctly report its own timing for live sources, causing periodic stalls), the intercom now reads **directly** from Home Assistant (`camera_proxy_stream`, the same endpoint the Lovelace frontend uses) and decodes JPEG itself — one heavy step, smooth real-time video, no extra load on Home Assistant.
- **Compatible with any `camera.*`**, regardless of the camera's native codec: `camera_proxy_stream` always normalizes to MJPEG.
- **Multi-camera**: add as many cameras as you like to the same screen — each runs its own independent pipeline on the intercom, without interfering with each other.
- **Universal direct URL**: even for a direct URL (not an HA entity), the codec is auto-detected (MJPEG or H.264, the latter via the VPU hardware decoder — `libimxvpuapi`, an official Freescale/NXP library already present on the intercom).
- **RTSP**: protocol support, for IP cameras that use it natively.
- **Automatic token refresh**: each camera's access token (which HA rotates every ~5 minutes) is refreshed ahead of time, instead of waiting for the pipeline to stall.
- **Reliable auto-stop**: the camera pipeline stops even when switching directly between screens, or when the intercom's real state changes (e.g. an incoming call) — not just on an explicit "hide".
- **Live view**: now also shows `fb0` (where the camera writes) underneath `fb1` (the GUI), not just the latter — truly reflects what's on screen.
- **Safer updates**: the update entity now waits for the intercom to come back online with the new version before considering itself done, avoiding the risk of overlapping two installs during a reboot.
- **Pending-update dot** on the "Intercom" button in the editor.
- Compiled sources included (`citofono/vpu-decode-src/`), with a technical README on why/how, for transparency and future maintenance.

## 0.12.2

**🇮🇹 Italiano**

- **Fix stato retroilluminazione durante/dopo una chiamata**: l'entità `light.retroilluminazione_display` poteva restare bloccata su "acceso" con lo schermo fisicamente spento, in certe fasi attorno a una chiamata in arrivo — causa: ci basavamo sullo stato interno di Qt (`global.screenState`), che in quella fase può disallinearsi dalla realtà. Ora l'add-on legge lo stato **direttamente dal kernel** (sysfs, `/sys/class/backlight/.../brightness`) tramite un nuovo endpoint sul controller, bypassando Qt del tutto per questa lettura specifica.
- Il QML non riporta più periodicamente lo stato (diventato ridondante); continua solo a eseguire i comandi accendi/spegni in arrivo da Home Assistant, che richiedono comunque l'API di Qt per agire sullo schermo.

**🇬🇧 English**

- **Fix for backlight state during/after a call**: the `light.retroilluminazione_display` entity could get stuck showing "on" with the screen physically off, in certain phases around an incoming call — cause: we relied on Qt's internal state (`global.screenState`), which can drift from reality during that phase. The add-on now reads the state **directly from the kernel** (sysfs, `/sys/class/backlight/.../brightness`) via a new controller endpoint, bypassing Qt entirely for this specific reading.
- The QML no longer periodically reports state (became redundant); it still only executes on/off commands coming from Home Assistant, which do require Qt's API to actually act on the screen.

## 0.12.1

**🇮🇹 Italiano**

- **Indicatore retroilluminazione ovunque**: oltre alla vista live, ora compare anche nella barra in alto dell'editor principale, sempre visibile mentre lavori.
- **Fix stato retroilluminazione dopo un riavvio dell'add-on**: il QML riportava lo stato solo quando cambiava; dopo un riavvio dell'add-on (che perde la memoria di sessione) restava "sconosciuto" finché qualcuno non toccava davvero lo schermo fisico. Ora riporta lo stato reale ad ogni ciclo (~300ms), così l'add-on lo riacquisisce subito. **Richiede una nuova installazione via SSH** (renderer QML aggiornato).
- **Testo più chiaro quando il citofono non mostra nulla**: "Citofono online" da solo non diceva molto; ora è "Citofono online — nessuna schermata a video".
- **Fix vista live**: il messaggio "Nessun tasto premuto" è stato tolto (resta vuoto finché non premi qualcosa), il feedback di un tasto premuto sparisce da solo dopo un paio di secondi invece di restare per sempre, e premere due volte di fila lo stesso tasto ora dà comunque un riscontro visivo (prima, a parità di testo, sembrava non fosse successo nulla).

**🇬🇧 English**

- **Backlight indicator everywhere**: besides the live view, it now also shows in the main editor's top bar, always visible while you work.
- **Fix for backlight state after an add-on restart**: the QML only reported state on change; after an add-on restart (which loses session memory) it stayed "unknown" until someone actually touched the physical screen. It now reports the real state every cycle (~300ms), so the add-on picks it up immediately. **Requires a new SSH install** (updated QML renderer).
- **Clearer wording when the intercom isn't showing anything**: "Intercom online" alone wasn't very informative; it now reads "Intercom online — nothing on screen".
- **Live view fixes**: the "No button pressed yet" message was removed (stays blank until you press something), the pressed-button feedback now fades away on its own after a couple of seconds instead of staying forever, and pressing the same button twice in a row now still gives a visible response (previously, since the text stayed identical, it looked like nothing had happened).

## 0.12.0

**🇮🇹 Italiano**

- **Visualizzazione live del display, riscritta da zero (noVNC)**: nuovo pulsante "Live" nell'editor. L'add-on fa da tubo WebSocket↔TCP verso un piccolo server VNC sul citofono; tutto il protocollo (handshake, *flow control*) è gestito da [noVNC](https://github.com/novnc/noVNC), libreria matura, nel browser. La prima versione (un client VNC scritto da zero dentro l'add-on, con un'immagine che il browser ricaricava a polling) si è rivelata troppo aggressiva per la CPU debole del citofono e ne causava il blocco sotto carico — sostituita interamente da questo approccio.
- **Controllo interattivo reale, a livello di sistema (ptrace)**: durante la visualizzazione live puoi premere i pulsanti del citofono da remoto (1-7, rotella su/giù/OK, rispondi/riaggancia/muto). Non è una simulazione dentro il QML: un piccolo strumento (`ptrace-inject`) si aggancia al processo grafico del citofono e inietta la pressione direttamente nelle sue chiamate di sistema — indistinguibile da una pressione fisica vera per il firmware, funziona **ovunque**, incluso il menu nativo di default (prima limitato alle sole schede create con l'add-on). Il controller (`:8080`) lo avvia/ferma e scopre da solo PID e numeri di device — vedi il nuovo endpoint `/ptrace-inject`, anche testabile a mano dalla pagina.
- **Nuova patch per il menu nativo**: una singola *property* aggiunta a `MainPage.qml` del citofono (backup automatico) abilita la navigazione su/giù/OK nel menu di default — prima la rotella lì si limitava a riaccendere lo schermo.
- **Nuova entità `light` — retroilluminazione display**: stato reale (letto dal citofono ogni ~300ms), con supporto ad accendere/spegnere il display direttamente da Home Assistant.
- **Installazione via SSH più completa**: carica sempre anche il componente di visualizzazione live, il patch del menu nativo, lo strumento di iniezione pulsanti, e **sostituisce il bundle di `c300x-controller`** (backup automatico) con una versione che aggiunge gli endpoint necessari — pagina del controller anche rinfrescata esteticamente e tradotta in inglese per intero.
- **Fix**: un bug nell'editor faceva restare evidenziati in giallo (come "configurati") i pulsanti nel pannello della vista live, per via di una classe CSS condivisa col pannello di configurazione principale non correttamente delimitata.
- ⚠️ **Nota sui rischi**: l'iniezione a livello di sistema (`ptrace`) è per natura più invasiva di una semplice chiamata QML — durante lo sviluppo ha causato un riavvio del citofono in un caso, poi non più riprodotto dopo una correzione (consegna un solo evento alla volta, come fa il device reale). Resta uno strumento da avviare al bisogno, non un servizio permanente.

**🇬🇧 English**

- **Live screen view, rewritten from scratch (noVNC)**: new "Live" button in the editor. The add-on now acts as a WebSocket↔TCP pipe to a small VNC server on the intercom; the whole protocol (handshake, flow control) is handled by [noVNC](https://github.com/novnc/noVNC), a mature library, in the browser. The first version (a hand-rolled VNC client inside the add-on, with the browser polling a still image) turned out to be too aggressive for the intercom's weak CPU and caused it to lock up under load — entirely replaced by this approach.
- **Real, system-level interactive control (ptrace)**: while the live view is open you can remotely press the intercom's buttons (1-7, wheel up/down/OK, answer/hang up/mute). This isn't a QML-level simulation: a small tool (`ptrace-inject`) attaches to the intercom's graphics process and injects the press directly into its system calls — indistinguishable from a real physical press as far as the firmware is concerned, and it works **everywhere**, including the native default menu (previously limited to screens created with the add-on). The controller (`:8080`) starts/stops it and auto-discovers the PID and device numbers — see the new `/ptrace-inject` endpoint, also manually testable from the page.
- **New patch for the native menu**: a single property added to the intercom's `MainPage.qml` (automatic backup) enables up/down/OK navigation in the default menu — previously the wheel there only woke the screen.
- **New `light` entity — display backlight**: real state (read from the intercom every ~300ms), with support for turning the display on/off directly from Home Assistant.
- **More complete SSH install**: now always uploads the live-view component, the native-menu patch, and the button-injection tool, and **replaces the `c300x-controller` bundle** (automatic backup) with a version that adds the needed endpoints — the controller page also got a cosmetic refresh and is now fully in English.
- **Fix**: a bug in the editor left buttons highlighted in yellow (as "configured") in the live view's button panel, due to a CSS class shared with the main configuration panel that wasn't properly scoped.
- ⚠️ **Risk note**: system-level injection (`ptrace`) is inherently more invasive than a simple QML call — during development it caused one intercom reboot, not reproduced since after a fix (deliver one event at a time, matching real device behavior). It remains a tool you start when needed, not a permanent service.

## 0.11.0

**🇮🇹 Italiano**

- **Nuove entità per capire cosa sta facendo davvero il citofono**: `sensor.pagina_attiva` (quale scheda è mostrata sul display in questo momento, `idle` se libero — copre anche la chiusura manuale con la rotella laterale e l'interruzione da chiamata reale) e `binary_sensor.citofono_occupato` (on quando la telecamera è in uso, per qualsiasi motivo: squillo reale, WebRTC, app locale o via LTE — rilevato a livello di bus OpenWebNet, non di rete, quindi copre tutti i casi con lo stesso meccanismo).
- **Rilevamento occupato via MQTT (opzionale)**: `citofono_occupato` legge il topic `Bticino/tx` pubblicato dal bridge [TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x), se installato sul citofono. Aggiunta anche `binary_sensor.ponte_mqtt_citofono_online` per sapere se quel bridge è raggiungibile. Se MQTT non è configurato in HA, o il bridge non è installato/avviato, le due entità degradano in modo esplicito (`unavailable`/default sicuro) invece di rompere l'integrazione.
- **Fix `pagina_attiva`**: il valore restava fermo alla prima scheda mostrata se ne aprivi un'altra sopra senza chiudere la precedente; ora si aggiorna ad ogni cambio.
- **`/api/citofono/live` più affidabile**: usa ora lo stesso segnale in tempo reale di `pagina_attiva` invece della vecchia euristica su sequenze show/hide, quindi anche l'indicatore nell'editor (accanto al nome del progetto) riflette correttamente il display reale.

**🇬🇧 English**

- **New entities to see what the intercom is really doing**: `sensor.pagina_attiva` (which screen is currently shown on the display, `idle` when free — covers manual closing via the side wheel and interruption by a real call) and `binary_sensor.citofono_occupato` (on while the camera is in use, for any reason: a real ring, WebRTC, the local app, or over LTE — detected at the OpenWebNet bus level, not the network level, so it covers all cases with the same mechanism).
- **MQTT-based occupancy detection (optional)**: `citofono_occupato` reads the `Bticino/tx` topic published by the [TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x) bridge, if installed on the intercom. Also added `binary_sensor.ponte_mqtt_citofono_online` to know if that bridge is reachable. If MQTT isn't configured in HA, or the bridge isn't installed/running, both entities degrade explicitly (`unavailable`/safe default) instead of breaking the integration.
- **Fix for `pagina_attiva`**: the value used to stay stuck on the first screen shown if you opened another on top without closing the previous one; now it updates on every change.
- **More reliable `/api/citofono/live`**: now uses the same real-time signal as `pagina_attiva` instead of the old show/hide sequence heuristic, so the indicator in the editor (next to the project name) correctly reflects the real display too.

## 0.10.1

**🇮🇹 Italiano**

- **Backup completo con le immagini**: l'export ora include anche le immagini caricate (non solo le schede). Reimportando un backup, le immagini vengono ripristinate automaticamente, così reinstallando l'add-on non si perde più nulla. I backup fatti con la 0.10.0 (solo schede) restano importabili.
- **Fix cache immagini**: le immagini non vengono più messe in cache in modo aggressivo dal browser; un'immagine ricaricata o ripristinata da backup appare subito, senza dover forzare il refresh (risolveva casi in cui un'immagine mancante restava "bloccata" come non trovata anche dopo averla ricaricata).
- **Anteprime schede aggiornate**: le miniature nella schermata iniziale mostrano ora i valori risolti (entità e template) invece del codice grezzo. Prima gli elementi template mostravano il codice Jinja non renderizzato.
- **Dati azione YAML annidati**: il campo "dati" delle azioni supporta ora YAML con struttura annidata e indentazione (es. `notify.mobile_app` con `data:` > `push:` > `sound:`). L'indentazione non viene più persa, sia scrivendo sia riaprendo l'azione. Le liste (`- ...`) e i tab sono supportati.
- **Rotella configurabile**: la rotella (su / OK / giù) è ora presente nell'editor come tre pulsanti sul lato destro del citofono; puoi assegnare azioni di Home Assistant a ciascuna direzione, esattamente come agli altri tasti. Il citofono già le gestiva: mancava solo il modo di configurarle.

**🇬🇧 English**

- **Full backup including images**: export now includes uploaded images too (not just screens). Re-importing a backup automatically restores images, so reinstalling the add-on no longer loses anything. Backups made with 0.10.0 (screens only) are still importable.
- **Image cache fix**: images are no longer aggressively cached by the browser; a reloaded or restored image shows up immediately, no need to force-refresh (fixed cases where a missing image stayed "stuck" as not-found even after re-uploading it).
- **Updated screen previews**: thumbnails on the home screen now show resolved values (entities and templates) instead of raw code. Previously template elements showed the un-rendered Jinja code.
- **Nested YAML action data**: the action "data" field now supports nested YAML with indentation (e.g. `notify.mobile_app` with `data:` > `push:` > `sound:`). Indentation is no longer lost, whether writing or reopening the action. Lists (`- ...`) and tabs are supported.
- **Configurable wheel**: the wheel (up / OK / down) is now present in the editor as three buttons on the right side of the intercom; you can assign Home Assistant actions to each direction, exactly like the other buttons. The intercom already handled them — it was just missing a way to configure them.

## 0.10.0

**🇮🇹 Italiano**

Release importante: pulsanti del citofono configurabili, editor completamente rinnovato con anteprima fedele del dispositivo, supporto template Jinja2 in stile Lovelace, e molte migliorie a icone, valori ed esperienza d'uso.

### Pulsanti del citofono
- **Front-button configurabili**: i tasti frontali (1-4, ★, serratura, occhio), la rotella (su/giù/OK) e le due cornette possono lanciare azioni di Home Assistant, definite per singola scheda e attive solo mentre la scheda è a schermo.
- **Illuminazione tasto**: opzione per-pulsante per accendere il LED del tasto alla pressione (di default spento). L'azione HA parte comunque.
- **Testo dinamico (toast)**: il messaggio mostrato a schermo alla pressione può contenere Jinja2, valutato in tempo reale (es. mostrare lo stato reale di una luce anche con un comando toggle).
- **Template nei dati dell'azione**: i valori del campo "dati" possono contenere Jinja2 (es. `temperature: "{{ state_attr('climate.x','temperature') + 1 }}"`), valutati da Home Assistant all'esecuzione e convertiti nel tipo corretto.
- **Cornette**: la cornetta sinistra (verde) risponde, la destra (rossa, icona appoggiata) riaggancia.
- **Diagnostica**: proprietà `debugKeys` nella SchedaPage per mostrare a schermo il keycode dei tasti premuti.

### Editor
- **Anteprima fedele del citofono**: il canvas 800×480 è incorniciato da una riproduzione fedele del Classe 100X (misure dal disegno tecnico e da foto reale): vetro, tacca sensore, icone wifi/campanello, tasti a pallini, riga stella/serratura/occhio, cornette. Icone SVG reali.
- **Adattamento allo schermo**: la vista si ridimensiona automaticamente per stare a schermo, con un po' di bordo. Barra di stato/zoom fissa in basso al centro.
- **Zoom e pan**: zoom con la rotellina, spostamento della vista con il tasto centrale del mouse, doppio clic centrale per ripristinare.
- **Manipolazione elementi**: sposta con le frecce (1px, Shift = 10px), z-order con PagSu/PagGiù, elimina con Canc, scorciatoie di allineamento (L/R/E/T/B/M) con più elementi selezionati, e bottoni dedicati nel pannello.
- **Raggruppamenti**: raggruppa più elementi (Ctrl+G) per spostarli e allinearli insieme; separa con Ctrl+Shift+G.
- **Rotazione**: i limiti ai bordi tengono conto dell'ingombro reale dell'elemento ruotato.
- **Configurazione pulsanti dal pannello Proprietà**: cliccando un tasto della scocca, la sua configurazione appare nel pannello a destra.

### Elemento Template (Jinja2 + markdown)
- **Nuovo elemento** che rende template come le card markdown di Lovelace: scrivi Jinja2 con markdown base (grassetto, corsivo, titoli, liste, a capo), reso formattato sul citofono. Anteprima live nell'editor.
- **Colore condizionale**: un secondo template può cambiare il colore dell'elemento, ritornando un colore diretto oppure true/false per usare due colori configurabili. Disponibile anche per le icone (statiche ed entità).

### Valori ed icone
- **Attributi oltre allo stato**: l'elemento Valore sensore può mostrare un attributo specifico (es. `temperature` di un `climate`), scelto da una tendina o digitato.
- **Unità di misura automatica**: aggiunge il suffisso dell'unità ai valori numerici (attiva di default, disattivabile).
- **Formato data/ora**: formatta date e orari (es. `DD/MM/YYYY`, `HH:mm`, `D MMMM YYYY`) invece del formato ISO grezzo, con mesi e giorni in italiano.
- **Icona weather corretta**: le entità `weather.*` mostrano l'icona meteo giusta in base alla condizione.
- **Forza icona**: per le icone entità puoi fissare manualmente un'icona MDI mantenendo il colore calcolato dallo stato.
- **Ricerca azione ed entità**: la scelta del servizio funziona come la ricerca delle entità (scrivi `light.toggle` o solo `toggle`).

### Schede
- **Aggiornamento automatico**: aprendo una scheda salvata, icone, valori e template si aggiornano subito allo stato attuale. Le anteprime nella schermata iniziale mostrano i dati aggiornati.
- **Export/Import**: esporta tutte le schede in un file di backup e reimportale, per non perdere il lavoro disinstallando l'add-on o spostandolo su un'altra istanza.

### Note tecniche
- Renderer della SchedaPage aggiornato (rispetto alla 0.9.4): dopo l'aggiornamento dell'add-on, **reinstalla la pagina dal Citofono**.
- Vari fix: chiamate ai servizi HA con target nel corpo (no errore 400), inoltro corretto dei campi `buttons`/`name` alla SchedaPage.

**🇬🇧 English**

Major release: configurable intercom buttons, a fully revamped editor with a faithful device preview, Lovelace-style Jinja2 template support, and many improvements to icons, values and overall UX.

### Intercom buttons
- **Configurable front buttons**: the front keys (1-4, ★, lock, eye), the wheel (up/down/OK) and the two handset icons can trigger Home Assistant actions, defined per screen and active only while that screen is on display.
- **Button lighting**: per-button option to light up the key's LED on press (off by default). The HA action fires regardless.
- **Dynamic text (toast)**: the on-screen message shown on press can contain Jinja2, evaluated in real time (e.g. showing a light's real state even with a toggle command).
- **Templates in action data**: values in the "data" field can contain Jinja2 (e.g. `temperature: "{{ state_attr('climate.x','temperature') + 1 }}"`), evaluated by Home Assistant at execution time and converted to the correct type.
- **Handsets**: the left (green) handset answers, the right (red, hung-up icon) hangs up.
- **Diagnostics**: `debugKeys` property on SchedaPage to show the keycode of pressed buttons on screen.

### Editor
- **Faithful intercom preview**: the 800×480 canvas is framed by a faithful reproduction of the Classe 100X (measurements from the technical drawing and real photos): glass, sensor notch, wifi/bell icons, dot buttons, star/lock/eye row, handsets. Real SVG icons.
- **Fit to screen**: the view automatically resizes to fit the screen, with a bit of margin. Fixed status/zoom bar at the bottom center.
- **Zoom and pan**: zoom with the scroll wheel, pan the view with the middle mouse button, middle double-click to reset.
- **Element manipulation**: move with arrow keys (1px, Shift = 10px), z-order with PageUp/PageDown, delete with Del, alignment shortcuts (L/R/C/T/B/M) with multiple elements selected, and dedicated buttons in the panel.
- **Grouping**: group multiple elements (Ctrl+G) to move and align them together; ungroup with Ctrl+Shift+G.
- **Rotation**: edge limits now account for the real bounding box of the rotated element.
- **Button configuration from the Properties panel**: clicking a shell button shows its configuration in the right-hand panel.

### Template element (Jinja2 + markdown)
- **New element** that renders templates like Lovelace markdown cards: write Jinja2 with basic markdown (bold, italic, headings, lists, line breaks), rendered formatted on the intercom. Live preview in the editor.
- **Conditional color**: a second template can change the element's color, either returning a color directly or true/false to pick between two configurable colors. Also available for icons (static and entity-based).

### Values and icons
- **Attributes beyond state**: the Sensor value element can show a specific attribute (e.g. `temperature` of a `climate`), picked from a dropdown or typed in.
- **Automatic unit of measurement**: appends the unit suffix to numeric values (on by default, can be disabled).
- **Date/time format**: formats dates and times (e.g. `DD/MM/YYYY`, `HH:mm`, `D MMMM YYYY`) instead of raw ISO format.
- **Correct weather icon**: `weather.*` entities show the right weather icon based on condition.
- **Force icon**: for entity icons you can manually pin an MDI icon while keeping the color computed from state.
- **Action and entity search**: picking a service now works like entity search (type `light.toggle` or just `toggle`).

### Screens
- **Automatic refresh**: opening a saved screen immediately updates icons, values and templates to the current state. Previews on the home screen show up-to-date data.
- **Export/Import**: export all screens to a backup file and re-import them, so you don't lose your work when uninstalling the add-on or moving it to another instance.

### Technical notes
- SchedaPage renderer updated (vs 0.9.4): after updating the add-on, **reinstall the page from Intercom**.
- Various fixes: HA service calls with target in the body (no more 400 error), correct forwarding of `buttons`/`name` fields to SchedaPage.

## 0.9.4

**🇮🇹 Italiano**

Risolto il blocco della GUI del citofono e completata la chiusura della scheda con la rotella.

- **Fix del blocco al boot**: `SchedaPage.qml` usava la proprieta' `mipmap` con `import QtQuick 2.0`, ma `mipmap` esiste solo da QtQuick 2.3. Su questo firmware (Qt 5.10) era un errore di compilazione che faceva fallire l'intero `main.qml`, lasciando la GUI bloccata al boot con i tasti non responsivi. Ora la pagina usa `import QtQuick 2.7` e `mipmap` e' stato rimosso (la nitidezza delle icone resta garantita da `sourceSize`).
- **Chiusura con la rotella**: confermati i codici dei tasti hardware (su = Key_Up, giu = Key_Down, pressione = Key_Return). La scheda si chiude con qualsiasi azione della rotella.
- **Renderer aggiornato a v3** (la `SchedaPage` e' cambiata): dopo l'aggiornamento dell'add-on, reinstalla la pagina dal Citofono.

**🇬🇧 English**

Fixed the intercom GUI freeze and completed screen closing via the wheel.

- **Boot freeze fix**: `SchedaPage.qml` used the `mipmap` property with `import QtQuick 2.0`, but `mipmap` only exists from QtQuick 2.3 onward. On this firmware (Qt 5.10) this was a compile error that made the entire `main.qml` fail, leaving the GUI stuck at boot with unresponsive keys. The page now uses `import QtQuick 2.7` and `mipmap` was removed (icon sharpness is still guaranteed by `sourceSize`).
- **Closing with the wheel**: confirmed the hardware key codes (up = Key_Up, down = Key_Down, press = Key_Return). The screen now closes with any wheel action.
- **Renderer updated to v3** (`SchedaPage` changed): after updating the add-on, reinstall the page from Intercom.

## 0.9.3

**🇮🇹 Italiano**

Ripubblicazione per far prendere a Home Assistant il fix del riavvio.

- Nessuna modifica funzionale rispetto alla 0.9.2: il fix del riavvio del citofono (`setsid`) era stato aggiunto sotto la versione 0.9.2 gia' installata, e HA non rileva aggiornamenti se il numero di versione non cambia. Questa versione esiste solo per forzare l'aggiornamento.
- Renderer invariato (v2). Dopo l'aggiornamento dell'add-on, reinstalla la pagina dal Citofono: ora il riavvio del citofono parte davvero.

**🇬🇧 English**

Re-published just to make Home Assistant pick up the reboot fix.

- No functional change vs 0.9.2: the intercom reboot fix (`setsid`) had been added under the already-installed 0.9.2 version, and HA doesn't detect updates if the version number doesn't change. This version exists purely to force the update.
- Renderer unchanged (v2). After updating the add-on, reinstall the page from Intercom: the intercom reboot now actually happens.

## 0.9.2

**🇮🇹 Italiano**

Ripristino della navigazione del citofono.

- Annullata la modifica della 0.9.1 che, forzando il focus tastiera sulla scheda e "accettando" tutti i tasti, rompeva la navigazione delle pagine stock del citofono (la rotella non apriva piu' i menu). La gestione dei tasti torna identica alla 0.8.0.
- Mantenuti i miglioramenti visivi introdotti nelle 0.8.x (font Roboto, icone nitide).
- **Fix del riavvio automatico** del citofono dopo l'install: prima il comando moriva alla chiusura della sessione SSH (SIGHUP) e usava un `reboot` non nel PATH, quindi il citofono non si riavviava e il QML nuovo non veniva ricaricato. Ora il riavvio e' staccato con `setsid` e usa `/sbin/reboot`.
- Il renderer e' cambiato: dopo aver aggiornato l'add-on, **reinstalla** la pagina con Citofono -> Installa/aggiorna.
- Nota: la chiusura della scheda con il pulsante a rotella verra' agganciata correttamente piu' avanti, sulla base del `main.qml` del dispositivo.

**🇬🇧 English**

Restored intercom navigation.

- Reverted the 0.9.1 change that, by forcing keyboard focus onto the screen and "accepting" all keys, broke navigation of the intercom's stock pages (the wheel no longer opened menus). Key handling is back to being identical to 0.8.0.
- Kept the visual improvements introduced in 0.8.x (Roboto font, sharp icons).
- **Automatic reboot fix** after install: previously the command died when the SSH session closed (SIGHUP) and used a `reboot` not in PATH, so the intercom never rebooted and the new QML was never reloaded. The reboot is now detached with `setsid` and uses `/sbin/reboot`.
- The renderer changed: after updating the add-on, **reinstall** the page via Intercom -> Install/update.
- Note: closing the screen with the wheel button will be properly hooked up later on, based on the device's `main.qml`.

## 0.9.1

**🇮🇹 Italiano**

Correzioni lato citofono e base per l'aggiornamento del renderer.

- Citofono: la scheda ora si chiude con **qualsiasi tasto o pulsante** (inclusa la rotella laterale) anche senza timeout impostato. Prima, senza timeout, la rotella non la nascondeva perche' la pagina non aveva il focus tastiera.
- Base per l'**aggiornamento del renderer**: il citofono comunica all'add-on la versione di `SchedaPage` installata (`/active?rv=`), e l'add-on espone `/api/citofono/status` per sapere se e' allineata. La notifica in Home Assistant e la Update entity arriveranno in una prossima versione.
- **Nota**: questa versione cambia il renderer lato citofono. Dopo aver aggiornato l'add-on, reinstalla la pagina con **Citofono → Installa/aggiorna**.

**🇬🇧 English**

Intercom-side fixes and groundwork for renderer updates.

- Intercom: the screen now closes with **any key or button** (including the side wheel) even without a timeout set. Previously, without a timeout, the wheel wouldn't hide it because the page didn't have keyboard focus.
- Groundwork for **renderer updates**: the intercom reports its installed `SchedaPage` version to the add-on (`/active?rv=`), and the add-on exposes `/api/citofono/status` to know if it's up to date. The Home Assistant notification and Update entity will arrive in a future version.
- **Note**: this version changes the intercom-side renderer. After updating the add-on, reinstall the page via **Intercom → Install/update**.

## 0.9.0

**🇮🇹 Italiano**

Editor potenziato.

- **Copia/incolla** degli elementi sulla tela (Ctrl+C / Ctrl+V, Ctrl+D duplica, Ctrl+A seleziona tutto).
- **Selezione multipla**: shift+clic o trascina sul vuoto per il rettangolo di selezione; sposti il gruppo insieme.
- **Allinea e distribuisci**: pannello con allineamento (sinistra/centro/destra, alto/centro/basso) e distribuzione automatica orizzontale/verticale.
- **Le mie schede**: all'avvio compare una galleria delle schermate salvate con anteprima e un pulsante grande per crearne una nuova. Sostituisce il vecchio menu a tendina.
- **Icone nella palette** accanto a ogni elemento aggiungibile; **logo del progetto** al posto del pallino in alto a sinistra.
- **Anteprima dell'icona** nel menu di scelta: ogni suggerimento mostra l'icona prima del nome.
- **Stato del citofono** nella barra in alto: indica se sta facendo polling e quale schermata e' impostata come attiva.
- Fix: i campi di testo non vengono piu' trattati come campi password dal browser (autofill disinnescato).
- Avviso **modifiche non salvate** quando crei o carichi un'altra schermata, cambi lingua o chiudi la pagina. Il cambio lingua non riapre piu' la galleria e ricarica la scheda aperta.

**🇬🇧 English**

Enhanced editor.

- **Copy/paste** of canvas elements (Ctrl+C / Ctrl+V, Ctrl+D duplicate, Ctrl+A select all).
- **Multiple selection**: shift+click or drag over empty space for a selection rectangle; move the group together.
- **Align and distribute**: panel with alignment (left/center/right, top/center/bottom) and automatic horizontal/vertical distribution.
- **My screens**: on startup a gallery of saved screens appears with previews and a big button to create a new one. Replaces the old dropdown menu.
- **Icons in the palette** next to each addable element; **project logo** instead of the dot in the top-left corner.
- **Icon preview** in the picker: every suggestion shows the icon before the name.
- **Intercom status** in the top bar: shows whether it's polling and which screen is set as active.
- Fix: text fields are no longer treated as password fields by the browser (autofill disabled).
- **Unsaved changes** warning when creating or loading another screen, changing language, or closing the page. Changing language no longer reopens the gallery and reloads the open screen.

## 0.8.2

**🇮🇹 Italiano**

- Icone MDI nitide davvero: l'add-on ora inietta `width`/`height` nell'SVG servito. Le icone MDI
  hanno solo `viewBox` 24x24, quindi il QtSvg del citofono le rasterizzava a 24px e poi le
  ingrandiva (sfocate); le immagini raster erano nitide perche' hanno risoluzione vera. Il citofono
  ora chiede la dimensione reale a schermo (`?s=`), cosi' l'icona viene generata gia' grande.
  NB: il fix e' nel server dell'add-on, quindi va aggiornato/ricostruito l'add-on, non solo il QML.

**🇬🇧 English**

- Truly sharp MDI icons: the add-on now injects `width`/`height` into the served SVG. MDI icons
  only have a 24x24 `viewBox`, so the intercom's QtSvg rasterized them at 24px and then scaled
  them up (blurry); raster images were sharp because they have real resolution. The intercom
  now requests the real on-screen size (`?s=`), so the icon is generated already at the right size.
  Note: the fix is in the add-on's server, so the add-on needs updating/rebuilding, not just the QML.

## 0.8.1

**🇮🇹 Italiano**

- Icone più nitide sul citofono: l'SVG ora viene rasterizzato alla dimensione reale a schermo
  (`sourceSize`) con smoothing, invece di essere scalato da 24px. Risolve le icone MDI "sgranate".
- Tipografia coerente tra editor e citofono: l'add-on imbarca **Roboto** (regular/bold) e lo usa
  sia nell'editor (`@font-face`) sia nel renderer QML (`FontLoader`), così l'anteprima coincide con
  ciò che appare sul display. Roboto si abbina alle icone Material Design (MDI).

**🇬🇧 English**

- Sharper icons on the intercom: the SVG is now rasterized at the real on-screen size
  (`sourceSize`) with smoothing, instead of being scaled up from 24px. Fixes "pixelated" MDI icons.
- Consistent typography between editor and intercom: the add-on bundles **Roboto** (regular/bold)
  and uses it both in the editor (`@font-face`) and in the QML renderer (`FontLoader`), so the
  preview matches what appears on the display. Roboto pairs with Material Design (MDI) icons.

## 0.8.0 — First public release

**🇮🇹 Italiano**

Prima pubblicazione del progetto. Comprende l'add-on di Home Assistant (editor + server),
il renderer lato citofono e l'integrazione opzionale con i servizi. Le funzionalità:

### Editor (interfaccia web dell'add-on)
- Editor drag-and-drop su tela 800×480 con salvataggio dei layout.
- Elementi: testo, valore sensore (con autocomplete entità e anteprima dal vivo), immagine
  (upload o scelta da `config/www`), icona MDI (autocomplete, servita come SVG ricolorabile),
  forme, linea e freccia.
- Rotazione degli elementi con maniglia stile Word, trascinamento e ridimensionamento fluidi.
- Guide di allineamento con snap agli altri elementi e ai centri/bordi dello schermo.
- Interfaccia tradotta (IT/EN) con selettore lingua e auto-rilevamento del browser.
- Integrata nella barra laterale di HA via Ingress.

### Server (add-on)
- Serve la schermata attiva al citofono con i valori delle entità risolti dal vivo (`GET /active`).
- Endpoint `POST /api/show` (con `name` e `duration` opzionali) e `POST /api/hide`.
- Cache-busting degli asset e header `no-cache` sull'interfaccia.
- **Installazione automatica sul citofono via SSH** (pulsante "Citofono"): upload di
  `SchedaPage.qml`, patch di `main.qml` con backup e riavvio. Algoritmi legacy del dropbear,
  upload senza sftp. Spunta per salvare o meno la password SSH.

### Lato citofono
- `SchedaPage.qml`: renderer che disegna tutti gli elementi (testo, valore live, immagine, icona,
  forme, linea, freccia, con rotazione).
- Il watcher gestisce gli eventi "show" e "hide"; la patch **aggiorna** il blocco a ogni installazione
  invece di saltarlo, così ogni "Installa" applica le novità.

### Integrazione Home Assistant (opzionale, v1.0.0)
- Config flow via UI e servizi `c100x_dashboard.show`, `c100x_dashboard.hide`,
  `c100x_dashboard.set_active` per richiamare le schede dalle automazioni per nome (e durata).
- Icona locale dell'integrazione in `brand/` (Home Assistant 2026.3+).

**🇬🇧 English**

First publication of the project. Includes the Home Assistant add-on (editor + server),
the intercom-side renderer, and the optional integration with its services. Features:

### Editor (add-on web interface)
- Drag-and-drop editor on an 800×480 canvas with layout saving.
- Elements: text, sensor value (with entity autocomplete and live preview), image
  (upload or pick from `config/www`), MDI icon (autocomplete, served as a recolorable SVG),
  shapes, line and arrow.
- Element rotation with a Word-style handle, smooth dragging and resizing.
- Alignment guides snapping to other elements and to screen centers/edges.
- Translated interface (IT/EN) with a language selector and browser auto-detection.
- Integrated into HA's sidebar via Ingress.

### Server (add-on)
- Serves the active screen to the intercom with entity values resolved live (`GET /active`).
- `POST /api/show` (with optional `name` and `duration`) and `POST /api/hide` endpoints.
- Cache-busting for assets and `no-cache` headers on the interface.
- **Automatic install on the intercom via SSH** ("Intercom" button): uploads
  `SchedaPage.qml`, patches `main.qml` with a backup, and reboots. Legacy dropbear algorithms,
  upload without sftp. Checkbox to save the SSH password or not.

### Intercom side
- `SchedaPage.qml`: renderer that draws all elements (text, live value, image, icon,
  shapes, line, arrow, with rotation).
- The watcher handles "show" and "hide" events; the patch **updates** the block on every
  install instead of skipping it, so every "Install" applies the latest changes.

### Home Assistant integration (optional, v1.0.0)
- UI config flow and `c100x_dashboard.show`, `c100x_dashboard.hide`,
  `c100x_dashboard.set_active` services to recall screens from automations by name (and duration).
- Local integration icon in `brand/` (Home Assistant 2026.3+).
