<p align="center"><img src="assets/icon-256.png" width="150" alt="C100X Dashboard"></p>

_Changelog: [c100x_dashboard/CHANGELOG.md](c100x_dashboard/CHANGELOG.md)_

# C100X Dashboard

> L'integrazione include la propria icona in `custom_components/c100x_dashboard/brand/` (Home Assistant 2026.3+).

Componi schermate personalizzate per un videocitofono **BTicino Classe 100X** e mostrale sul suo
display da **Home Assistant**, con i valori dei sensori aggiornati dal vivo. Le schermate si
creano trascinando elementi su una tela 800×480 in un editor web; il citofono mostra la schermata
attiva e ne aggiorna i valori ogni secondo.

> 🇬🇧 [Read in English](README.md)

![Schermata dell'editor](docs/screenshot.png)

> **Nota sulla paternità del progetto.** Circa il **99% di questo progetto è stato scritto da
> Claude** (l'IA di Anthropic), a partire da obiettivi, test e riscontri sul dispositivo forniti
> dal proprietario della repo. Il proprietario ha guidato il design, provato tutto su hardware
> reale e validato ogni passo; il codice, il QML, l'add-on e l'integrazione sono opera di Claude.

## Cosa contiene

- **Add-on** (`c100x_dashboard/`) — add-on di Home Assistant che è insieme l'**editor** (interfaccia
  web) e il **server** che il citofono interroga. Legge i valori delle entità da HA, renderizza i
  template Jinja2 e serve la schermata attiva, le immagini e le icone via HTTP.
- **Lato citofono** (`c100x_dashboard/citofono/`) — `SchedaPage.qml`, il renderer che gira sul
  citofono, e gli script di patch. Installabile in automatico dall'add-on via SSH.
- **Integrazione** (`custom_components/c100x_dashboard/`) — integrazione opzionale di Home Assistant
  che aggiunge i servizi (`show`, `hide`, `set_active`) per richiamare le schede per nome dalle
  automazioni.

## Come funziona

```
Editor (add-on) ──salva──> layout schermate (JSON)
                                │
automazione HA / Node-RED ─show─> add-on ──GET /active──> citofono (polling ~1s)
                                   │                          │
                                   └─ legge i valori da HA ───┘ valori aggiornati dal vivo
```

Il citofono interroga `http://<add-on>:8099/active` ogni secondo. Quando "mostri" una schermata,
il citofono si accende e la visualizza; i valori si aggiornano mentre resta a video. Puoi
nasconderla a comando (utile per "mostra durante un blackout, nascondi quando torna la corrente").

## Prerequisiti

- Un BTicino **Classe 100X** con accesso SSH e il controller della community
  ([fquinto/bticinoClasse300x](https://github.com/fquinto/bticinoClasse300x) / [slyoldfox/c300x-controller](https://github.com/slyoldfox/c300x-controller)).
- **Home Assistant** con Supervisor (Home Assistant OS o Supervised), necessario per gli add-on.
- Citofono e HA sulla stessa LAN; il citofono deve raggiungere HA via **HTTP**.
- Node.js presente sul citofono (incluso nel setup del controller) per la patch QML.

## Installare l'add-on

**Come add-on locale (più semplice):**

1. Copia la cartella `c100x_dashboard/` nella cartella `/addons/` di Home Assistant
   (tramite gli add-on *Samba*, *SSH & Web Terminal* o *Studio Code Server*).
2. Impostazioni → Add-on → Store → ⋮ → **Check for updates**. Compare sotto *Local add-ons*.
3. Aprilo → **Installa** (la prima build scarica anche le icone MDI), poi **Avvia**.
4. L'editor compare nella barra laterale di HA (Ingress). È anche su `http://IP_HA:8099/`.

**Come add-on repository (un clic per altri):** pubblica questa repo su GitHub, poi in HA aggiungi
l'URL della repo in Store → ⋮ → *Repositories*.

> Per distribuire le modifiche, aumenta `version:` in `config.yaml`: Home Assistant propone allora un **Aggiorna** per l'add-on (Impostazioni → Add-on → Store → ⋮ → **Controlla aggiornamenti**). Il ⋮ → **Rebuild** dell'add-on serve solo a forzare una ricostruzione senza cambio di versione.

## Usare l'editor

**Elementi** — aggiungili dalla palette: testo, valore sensore, icona entità, template, immagine,
icona, forme, linea, freccia.

- **Valore sensore**: cerca l'entità (autocomplete) con anteprima dal vivo. In più puoi mostrare
  un **attributo** specifico invece dello stato, aggiungere in automatico l'**unità di misura** e
  **formattare date/orari** (es. `DD/MM/YYYY`, `HH:mm`).
- **Icona entità**: icona e colore seguono lo stato. Puoi **forzare un'icona** mantenendo il
  colore dallo stato, oppure pilotare il colore con un **template condizionale**.
- **Template**: scrivi Jinja2 con markdown base (grassetto, corsivo, titoli, liste, a capo), reso
  come una card markdown di Lovelace. Un secondo template può impostare il colore in modo
  condizionale (un colore diretto, oppure true/false → due colori configurabili).

**Pulsanti del citofono** — clicca un tasto sul citofono a schermo per assegnargli un'azione di
Home Assistant. Sono supportati i tasti frontali (1–4, ★, serratura, occhio), la rotella
(su/giù/OK) e le due cornette. Ogni pulsante può mostrare un messaggio a schermo (che può
contenere Jinja2 per testo dinamico) e opzionalmente illuminarsi alla pressione. Anche i dati
dell'azione possono contenere template Jinja2.

**Modifica** — trascina per spostare, maniglia in basso a destra per ridimensionare, quella in
alto per ruotare. Inoltre:

- Le frecce spostano di 1px (Shift = 10px), PagSu/PagGiù cambiano l'ordine di sovrapposizione,
  Canc elimina.
- Seleziona più elementi (Shift-clic o selezione a rettangolo) per allinearli; **raggruppa** con
  Ctrl+G, separa con Ctrl+Shift+G.
- Zoom con la rotellina, sposta la vista con il tasto centrale, doppio clic centrale per
  ripristinare.

**Schede** — dai un nome al layout e **Salva**; premi **Mostra ora** (con una durata) per
visualizzarlo sul citofono. Dalla schermata iniziale puoi **esportare** tutte le schede in un file
di backup e **importarle**, per non perdere il lavoro se reinstalli l'add-on.

## Installare sul citofono

Premi **Citofono** nell'editor, inserisci host/utente/password SSH del citofono e l'**URL
dell'add-on come lo vede il citofono** (es. `http://192.168.1.10:8099`), poi
**Installa / aggiorna**. Questo carica `SchedaPage.qml`, applica la patch a `main.qml` (con
backup), applica la patch a `MainPage.qml` — il menu nativo di default — per abilitare la
navigazione con la rotella anche lì (una singola `property` aggiunta, backup automatico),
carica il componente per la visualizzazione live e lo strumento di iniezione pulsanti
`ptrace-inject` (vedi sotto), **sostituisce il bundle di
[c300x-controller](https://github.com/slyoldfox/c300x-controller)** sul citofono con una
versione che aggiunge il supporto avvio/stop per entrambi (backup automatico dell'originale,
e la sua pagina `:8080` ha ricevuto anche una rinfrescata estetica ed è ora interamente in
inglese), e riavvia. Una spunta decide se salvare la password SSH nell'add-on o chiederla
ogni volta.

Preferisci l'installazione manuale? Vedi `c100x_dashboard/citofono/README.md`.

## Visualizzazione live e controllo da remoto

Premi **Live** nell'editor per un mirroring reale e interattivo dello schermo del citofono:
l'add-on fa da tubo WebSocket verso un piccolo server VNC sul citofono, e
[noVNC](https://github.com/novnc/noVNC) (libreria matura, inclusa nel progetto) gestisce il
protocollo vero e proprio nel browser — questo ha sostituito un primo approccio più semplice
(l'add-on che ricaricava un'immagine statica a intervalli), rivelatosi troppo pesante per la
CPU debole del citofono e capace di bloccarne il server VNC sotto carico.

Mentre è aperta hai anche un pannello pulsanti (1-7, rotella su/giù/OK, rispondi/riaggancia/muto)
che **preme davvero i pulsanti del citofono a livello di sistema**: un piccolo strumento
(`ptrace-inject`) si aggancia al processo grafico del citofono e inietta la pressione
direttamente nelle sue chiamate di sistema — indistinguibile da una pressione fisica vera per
il firmware. A differenza di un approccio basato sul richiamare funzioni QML, questo funziona
**ovunque**: dentro le schede create con questo add-on, e anche nel menu nativo di default del
citofono.

Richiede il bundle personalizzato del controller citato sopra (è quello che avvia/ferma sia il
server VNC sia l'iniettore sul citofono), quindi entrambi fanno ora parte dell'installazione SSH
standard, non sono più opzionali.

Un piccolo indicatore della retroilluminazione (schermo acceso/spento) è sempre visibile sia
nella vista live sia nella barra in alto dell'editor, e riflette lo stato reale del citofono.

> **Una nota sui rischi.** L'iniezione a livello di sistema tramite `ptrace` è per natura più
> invasiva di una semplice chiamata a una funzione QML — durante lo sviluppo ha causato un
> riavvio del citofono (mai più riprodotto da allora, dopo una correzione: ora consegna un solo
> evento tastiera alla volta, come si comporta davvero il driver del device). Per questo motivo
> l'iniettore viene avviato solo mentre la vista Live è aperta, e fermato pochi secondi dopo che
> la chiudi o perdi la connessione — **non** è pensato per girare come servizio permanente in
> background.

## Installare l'integrazione (opzionale)

L'integrazione è **separata dall'add-on** e **non viene installata in automatico** — l'add-on non
può scrivere nella cartella `custom_components/` di HA. Ti serve solo se vuoi i comodi servizi
`show` / `hide` / `set_active` nelle automazioni; senza, puoi comunque comandare l'add-on via REST
(vedi sotto).

1. Copia `custom_components/c100x_dashboard/` nella cartella `config/custom_components/` di HA
   (oppure aggiungi questa repo a HACS come *integration*).
2. Riavvia Home Assistant.
3. Impostazioni → Dispositivi e servizi → **Aggiungi integrazione → C100X Dashboard** e indica
   l'URL dell'add-on (es. `http://192.168.1.10:8099`).

Per lo storico delle versioni dell'integrazione (indipendente da quello dell'add-on), vedi
[`custom_components/c100x_dashboard/CHANGELOG.md`](custom_components/c100x_dashboard/CHANGELOG.md).

## Entità esposte dall'integrazione

Oltre ai servizi `show`/`hide`/`set_active`, l'integrazione crea alcune entità sotto lo stesso
dispositivo:

- **Intercom renderer** (`update.*`) — indica se la patch QML sul citofono corrisponde a quella
  distribuita da questa versione dell'add-on.
- **Pagina attiva** (`sensor.*`) — quale scheda è davvero mostrata sul display fisico in questo
  momento (`idle` quando lo schermo è libero: home, chiuso con la rotella laterale, spento dallo
  standby nativo del citofono, o interrotto da una chiamata reale). Interrogato ogni 2s su un
  valore che l'add-on tiene già in memoria — aggiornato in tempo reale dalla patch QML e
  incrociato con la retroilluminazione fisica letta dal sysfs, cosi' non resta bloccato sul nome
  di una scheda quando lo schermo è davvero spento — quindi nessun impatto aggiuntivo sul
  citofono.
- **Citofono occupato** (`binary_sensor.*`) — attivo mentre la telecamera del citofono è in uso,
  per qualsiasi motivo: squillo reale, bundle WebRTC, app BTicino in locale o via LTE. Rilevato a
  livello di bus OpenWebNet, non di rete, quindi copre tutti i casi con lo stesso meccanismo.
  Richiede MQTT — vedi sotto.
- **Ponte MQTT citofono online** (`binary_sensor.*`) — se il ponte MQTT descritto sotto è
  raggiungibile.
- **Retroilluminazione display** (`light.*`) — la retroilluminazione del display del citofono.
  Riflette lo stato reale (letto ogni ~2s) e può essere accesa/spenta direttamente da Home
  Assistant.

### Rilevamento occupato via MQTT (opzionale)

"Citofono occupato" richiede due componenti da configurare a parte, entrambi opzionali:

1. L'**integrazione MQTT** di Home Assistant, configurata sullo stesso broker che il citofono
   può raggiungere.
2. **[TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x)** installato e avviato sul
   citofono (`/etc/tcpdump2mqtt`), che pubblica il traffico OpenWebNet grezzo sul topic
   `Bticino/tx` e il proprio stato online/offline su `Bticino/LastWillT`.

Se manca uno dei due pezzi, entrambe le entità degradano in modo esplicito invece di rompere
l'integrazione:
- Nessuna integrazione MQTT configurata in HA → entrambe le entità restano `unavailable`, con un
  warning una tantum nei log di HA.
- MQTT configurato ma il ponte non pubblica mai nulla → `citofono_occupato` parte da `off`
  (assume libero) e `ponte_mqtt_citofono_online` resta `unknown` finché non arriva il messaggio
  Last Will (retained) del ponte.

Attenzione nota lato citofono: lo script di avvio di `TcpDump2Mqtt` controlla la presenza del
gateway di default una sola volta; con un Wi-Fi lento a riconnettersi dopo un riavvio può
arrendersi prima che `wlan0` abbia un IP, e nessuno lo rilancia più da solo. Se
`binary_sensor.ponte_mqtt_citofono_online` resta off dopo un riavvio, collegati via SSH e rilancia
`/etc/tcpdump2mqtt/TcpDump2Mqtt.sh` a mano — oppure trasforma il controllo del gateway in un ciclo
di retry (vedi `c100x_dashboard/citofono/README.md`).

## Richiamare le schede da Home Assistant

**Con l'integrazione.** Una volta installata (vedi sopra), ottieni queste azioni:

```yaml
# Mostra una schermata per nome, resta finché non la nascondi
action: c100x_dashboard.show
data:
  name: consumi
  duration: 0

# Nascondi ciò che è a schermo
action: c100x_dashboard.hide

# Imposta solo la schermata attiva (senza mostrarla)
action: c100x_dashboard.set_active
data:
  name: consumi
```

**Senza integrazione (REST).** L'add-on è un piccolo server REST: bastano due chiamate da Node-RED
(nodi `http request`) o da `rest_command` di HA:

```yaml
rest_command:
  citofono_mostra:
    url: "http://192.168.1.10:8099/api/show"
    method: POST
    content_type: "application/json"
    payload: '{"name":"{{ name }}","duration":{{ duration | default(0) }}}'
  citofono_nascondi:
    url: "http://192.168.1.10:8099/api/hide"
    method: POST
```

## Note e limiti

- La porta 8099 è esposta sulla LAN senza autenticazione (il citofono deve raggiungerla). Su rete
  domestica è accettabile.
- Il display del citofono ha una gamma colori limitata: grafiche piatte, icone e forme rendono
  benissimo; le foto possono virare di colore.
- Sono supportate solo le icone MDI (set incluso in HA); i pacchetti icone custom non vengono serviti.
- Gli elementi template supportano markdown **di base** (grassetto, corsivo, titoli, liste, a capo):
  il citofono rende un sottoinsieme di HTML (Qt 5 RichText), quindi markdown molto complesso
  potrebbe non essere reso in modo perfetto.
- La password SSH, se salvata, è memorizzata in chiaro in `/data` dell'add-on e non viene mai
  restituita al browser.
- La visualizzazione live consuma CPU reale sul citofono (server VNC + iniettore pulsanti): va
  bene per uso occasionale, non è pensata per restare accesa in continuazione — vedi la nota sui
  rischi qui sopra riguardo `ptrace`.

## Crediti

Questo progetto si appoggia al lavoro di reverse engineering fatto prima dalla community dei citofoni BTicino:

- [slyoldfox/c300x-controller](https://github.com/slyoldfox/c300x-controller) — il controller che gira sul citofono e su cui questo progetto si basa (runtime Node, endpoint HTTP, ponte verso Home Assistant).
- [slyoldfox/c300x-dashboard](https://github.com/slyoldfox/c300x-dashboard) — l'ispirazione: una dashboard QML alimentata dal controller, pensata per il C300X (Qt 4.8.7 / QtQuick 1.x). Dato che dichiara *"Bticino c100x devices are untested"* e usa una generazione Qt/QtQuick diversa, il renderer di questo progetto è stato riscritto da zero per il C100X (Qt5 / QtQuick 2.x).
- [fquinto/bticinoClasse300x](https://github.com/fquinto/bticinoClasse300x) — il firmware modificato che rende possibile l'accesso root/SSH.
- [Roboto](https://fonts.google.com/specimen/Roboto) (Apache License 2.0) — il font imbarcato, condiviso tra editor e renderer del citofono.
- [novnc/noVNC](https://github.com/novnc/noVNC) — la libreria client VNC (inclusa nel progetto) che alimenta la visualizzazione live nel browser.

## Licenza

MIT — vedi `LICENSE`.
