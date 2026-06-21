# C100X Dashboard (add-on Home Assistant)

Add-on che fa da **editor** e da **server** delle schermate mostrate sul display del
videocitofono BTicino Classe 100X. Componi le schermate trascinando elementi su una tela
800×480, le salvi, e il citofono interroga questo add-on (in HTTP, sulla LAN) per ricevere
il layout attivo con i **valori dei sensori aggiornati dal vivo**.

> Stato attuale: **v0.9.2** — editor IT/EN (multi-selezione, allinea/distribuisci, copia/incolla, galleria schermate), lato citofono, installazione SSH, show/hide via API.
> Vedi il README della repo per integrazione HA e installazione completa. (rotazione con maniglia, guide di allineamento, linee/frecce,
> icone, upload e scelta immagini, interfaccia integrata in HA via Ingress). È incluso anche il
> lato citofono (`citofono/SchedaPage.qml`) che disegna le schede; l'installazione su citofono
> può essere fatta in automatico dal pulsante **Citofono** (SSH), oppure manualmente
> (vedi `citofono/README.md`). Prossimo passo: traduzione inglese.

## Architettura

```
Editor (questo add-on)  ──salva──>  layout JSON (in /data/layouts)
                                         │
Node-RED ──POST /api/active "X"──>  add-on  ──GET /active──>  citofono (polling ~1s)
                                     │                            │
                                     └─ legge i valori da HA ─────┘ aggiorna i valori dal vivo
```

Il layout descrive *cosa* mostrare e *dove*; quando il citofono chiede `/active`, l'add-on
risolve i valori correnti delle entità e li restituisce già pronti. Siccome il citofono
ripete la richiesta ogni secondo, i valori si aggiornano da soli a video.

## Elementi disponibili

- **Testo** — etichetta fissa (font, colore, grassetto, allineamento).
- **Valore sensore** — stato di un'entità HA con prefisso/suffisso e decimali. Campo entità
  con **autocomplete** e anteprima del valore reale.
- **Immagine** — da URL, **caricata** (upload nell'editor) o scelta dalla **galleria**
  (immagini caricate + quelle già presenti in `config/www` di HA).
- **Icona** — icona MDI con **autocomplete**; suggerisce anche le icone **già in uso** dalle
  tue entità. Servita come SVG ricolorabile, pronta per il citofono.
- **Forme** — rettangolo, cerchio, triangolo, **linea** e **freccia** (colore, spessore).
- **Rotazione** — maniglia tonda sopra l'elemento (stile Word) per ruotare; aggancio a 15° se la griglia è attiva.
- **Sfondo** — colore della schermata.

Gli elementi si trascinano e si ridimensionano in modo fluido, con **guide di allineamento**
che agganciano bordi e centri agli altri elementi e ai centri dello schermo (stile editor grafico).
Griglia opzionale (10px). `Canc` elimina l'elemento selezionato. Il ridimensionamento è più preciso a rotazione 0.

## Installazione (local add-on)

1. **Accedi alla cartella `/addons`** del tuo Home Assistant (via *Samba share*,
   *Advanced SSH & Web Terminal* o *Studio Code Server*).
2. Copia l'intera cartella `c100x-dashboard/` dentro `/addons/`.
3. In HA: **Impostazioni → Add-on → Store**, ⋮ → **Check for updates**. Comparirà sotto
   **Local add-ons**.
4. Aprilo → **Installa** (la prima build richiede qualche minuto; scarica anche il set di
   icone MDI), poi **Avvia**.
5. Log: devi vedere `in ascolto sulla porta 8099`, `SUPERVISOR_TOKEN presente` e il numero
   di icone MDI caricate.
6. **Interfaccia**: l'editor compare nella **barra laterale di HA** (grazie all'Ingress);
   in alternativa è raggiungibile su `http://IP_HOME_ASSISTANT:8099/`.

Quando aggiorni i file dell'add-on premi **Ricostruisci** (Rebuild), non solo Riavvia.

## Uso rapido

1. Aggiungi gli elementi dalla palette e impostane le proprietà a destra.
2. Per un valore sensore: cerca l'entità nel campo con autocomplete; l'anteprima si aggiorna.
3. Dai un nome al layout e premi **Salva**.
4. Premi **Imposta attiva** per scegliere la schermata mostrata sul citofono.
5. Premi **Mostra ora** (con la durata desiderata) per farla comparire subito sul citofono.
6. Da Node-RED: `POST /api/active {"name":"consumi"}` poi `POST /api/show {"duration":0}`.

## Endpoint principali

| Metodo | Endpoint | Scopo |
|---|---|---|
| GET | `/` | editor |
| GET | `/api/layouts` · `/api/layouts/:nome` | elenco / leggi-salva-elimina layout |
| GET/POST | `/api/active` | leggi / imposta il layout attivo |
| POST | `/api/show` | mostra la scheda (body `{"name":"…","duration":sec}`) |
| POST | `/api/hide` | nasconde la scheda mostrata |
| GET | `/api/entities` | elenco entità HA (autocomplete) |
| GET | `/api/icons?q=` | ricerca icone MDI (autocomplete) |
| GET | `/icon/:name?color=RRGGBB` | SVG dell'icona (per editor e citofono) |
| GET/POST/DELETE | `/api/images` · `/image/:name` | immagini caricate |
| GET | `/api/ha-images` · `/ha-image/:name` | immagini presenti in `config/www` di HA |
| GET | `/api/entity-icons` | icone MDI già in uso dalle entità |
| GET | `/api/state/:entity` | stato di un'entità (anteprima) |
| GET/POST | `/api/citofono/settings` | impostazioni SSH del citofono |
| POST | `/api/citofono/install` | carica QML + patch + riavvio via SSH |
| GET | `/active` | **per il citofono**: layout attivo con i valori risolti |
| GET | `/health` | stato dell'add-on |

## Installare sul citofono (SSH)

Premi **Citofono** nella barra in alto, inserisci IP, utente e password SSH del citofono e
l'**URL dell'add-on come lo vede il citofono** (es. `http://192.168.1.10:8099`), poi
**Installa / aggiorna**. L'add-on carica `SchedaPage.qml`, applica la patch a `main.qml`
(con backup) e riavvia il citofono. Funziona con il dropbear del citofono (algoritmi legacy,
upload senza sftp).

La spunta **Salva la password** decide se memorizzarla nell'add-on (in `/data`, in chiaro)
oppure chiederla ogni volta. La password salvata non viene mai restituita all'interfaccia.

In alternativa, l'installazione manuale è descritta in `citofono/README.md`.

## File

- `config.yaml` — manifest (porta, permessi).
- `Dockerfile` — build del container (base Node.js).
- `app/server.js` — server ed endpoint.
- `app/static/` — editor (`index.html`, `style.css`, `editor.js`).

## Note

- La porta **8099** è esposta sulla LAN senza autenticazione, perché il citofono deve
  poterla interrogare. Su rete domestica è accettabile.
- I layout sono in `/data/layouts` (storage persistente dell'add-on).
- Lettura entità via API del Supervisor: nessun long-lived token da inserire.
- Le icone usano il pacchetto `@mdi/svg` incluso nell'immagine: ~50 MB in più sulla build,
  ma l'add-on resta autonomo e serve le icone in HTTP al citofono.
- **Ingress**: l'editor è integrato nella barra laterale di HA (autenticato). La porta 8099
  resta comunque esposta perché è quella che interroga il citofono.
- **Immagini di HA**: l'add-on legge in sola lettura la cartella `www` di Home Assistant
  (`homeassistant_config:ro`) e le serve su `/ha-image/...`, così il citofono le scarica
  sempre dall'add-on (un solo host).
- I pacchetti icone **custom** (non-MDI) non sono supportati: non sono servibili al citofono.
