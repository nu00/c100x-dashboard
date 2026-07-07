# Changelog

## 0.11.0

- **Nuove entità per capire cosa sta facendo davvero il citofono**: `sensor.pagina_attiva` (quale scheda è mostrata sul display in questo momento, `idle` se libero — copre anche la chiusura manuale con la rotella laterale e l'interruzione da chiamata reale) e `binary_sensor.citofono_occupato` (on quando la telecamera è in uso, per qualsiasi motivo: squillo reale, WebRTC, app locale o via LTE — rilevato a livello di bus OpenWebNet, non di rete, quindi copre tutti i casi con lo stesso meccanismo).
- **Rilevamento occupato via MQTT (opzionale)**: `citofono_occupato` legge il topic `Bticino/tx` pubblicato dal bridge [TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x), se installato sul citofono. Aggiunta anche `binary_sensor.ponte_mqtt_citofono_online` per sapere se quel bridge è raggiungibile. Se MQTT non è configurato in HA, o il bridge non è installato/avviato, le due entità degradano in modo esplicito (`unavailable`/default sicuro) invece di rompere l'integrazione.
- **Fix `pagina_attiva`**: il valore restava fermo alla prima scheda mostrata se ne aprivi un'altra sopra senza chiudere la precedente; ora si aggiorna ad ogni cambio.
- **`/api/citofono/live` più affidabile**: usa ora lo stesso segnale in tempo reale di `pagina_attiva` invece della vecchia euristica su sequenze show/hide, quindi anche l'indicatore nell'editor (accanto al nome del progetto) riflette correttamente il display reale.

## 0.10.1

- **Backup completo con le immagini**: l'export ora include anche le immagini caricate (non solo le schede). Reimportando un backup, le immagini vengono ripristinate automaticamente, così reinstallando l'add-on non si perde più nulla. I backup fatti con la 0.10.0 (solo schede) restano importabili.
- **Fix cache immagini**: le immagini non vengono più messe in cache in modo aggressivo dal browser; un'immagine ricaricata o ripristinata da backup appare subito, senza dover forzare il refresh (risolveva casi in cui un'immagine mancante restava "bloccata" come non trovata anche dopo averla ricaricata).
- **Anteprime schede aggiornate**: le miniature nella schermata iniziale mostrano ora i valori risolti (entità e template) invece del codice grezzo. Prima gli elementi template mostravano il codice Jinja non renderizzato.
- **Dati azione YAML annidati**: il campo "dati" delle azioni supporta ora YAML con struttura annidata e indentazione (es. `notify.mobile_app` con `data:` > `push:` > `sound:`). L'indentazione non viene più persa, sia scrivendo sia riaprendo l'azione. Le liste (`- ...`) e i tab sono supportati.
- **Rotella configurabile**: la rotella (su / OK / giù) è ora presente nell'editor come tre pulsanti sul lato destro del citofono; puoi assegnare azioni di Home Assistant a ciascuna direzione, esattamente come agli altri tasti. Il citofono già le gestiva: mancava solo il modo di configurarle.

## 0.10.0

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

## 0.9.4

Risolto il blocco della GUI del citofono e completata la chiusura della scheda con la rotella.

- **Fix del blocco al boot**: `SchedaPage.qml` usava la proprieta' `mipmap` con `import QtQuick 2.0`, ma `mipmap` esiste solo da QtQuick 2.3. Su questo firmware (Qt 5.10) era un errore di compilazione che faceva fallire l'intero `main.qml`, lasciando la GUI bloccata al boot con i tasti non responsivi. Ora la pagina usa `import QtQuick 2.7` e `mipmap` e' stato rimosso (la nitidezza delle icone resta garantita da `sourceSize`).
- **Chiusura con la rotella**: confermati i codici dei tasti hardware (su = Key_Up, giu = Key_Down, pressione = Key_Return). La scheda si chiude con qualsiasi azione della rotella.
- **Renderer aggiornato a v3** (la `SchedaPage` e' cambiata): dopo l'aggiornamento dell'add-on, reinstalla la pagina dal Citofono.

## 0.9.3

Ripubblicazione per far prendere a Home Assistant il fix del riavvio.

- Nessuna modifica funzionale rispetto alla 0.9.2: il fix del riavvio del citofono (`setsid`) era stato aggiunto sotto la versione 0.9.2 gia' installata, e HA non rileva aggiornamenti se il numero di versione non cambia. Questa versione esiste solo per forzare l'aggiornamento.
- Renderer invariato (v2). Dopo l'aggiornamento dell'add-on, reinstalla la pagina dal Citofono: ora il riavvio del citofono parte davvero.

## 0.9.2

Ripristino della navigazione del citofono.

- Annullata la modifica della 0.9.1 che, forzando il focus tastiera sulla scheda e "accettando" tutti i tasti, rompeva la navigazione delle pagine stock del citofono (la rotella non apriva piu' i menu). La gestione dei tasti torna identica alla 0.8.0.
- Mantenuti i miglioramenti visivi introdotti nelle 0.8.x (font Roboto, icone nitide).
- **Fix del riavvio automatico** del citofono dopo l'install: prima il comando moriva alla chiusura della sessione SSH (SIGHUP) e usava un `reboot` non nel PATH, quindi il citofono non si riavviava e il QML nuovo non veniva ricaricato. Ora il riavvio e' staccato con `setsid` e usa `/sbin/reboot`.
- Il renderer e' cambiato: dopo aver aggiornato l'add-on, **reinstalla** la pagina con Citofono -> Installa/aggiorna.
- Nota: la chiusura della scheda con il pulsante a rotella verra' agganciata correttamente piu' avanti, sulla base del `main.qml` del dispositivo.

## 0.9.1

Correzioni lato citofono e base per l'aggiornamento del renderer.

- Citofono: la scheda ora si chiude con **qualsiasi tasto o pulsante** (inclusa la rotella laterale) anche senza timeout impostato. Prima, senza timeout, la rotella non la nascondeva perche' la pagina non aveva il focus tastiera.
- Base per l'**aggiornamento del renderer**: il citofono comunica all'add-on la versione di `SchedaPage` installata (`/active?rv=`), e l'add-on espone `/api/citofono/status` per sapere se e' allineata. La notifica in Home Assistant e la Update entity arriveranno in una prossima versione.
- **Nota**: questa versione cambia il renderer lato citofono. Dopo aver aggiornato l'add-on, reinstalla la pagina con **Citofono → Installa/aggiorna**.

## 0.9.0

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

## 0.8.2

- Icone MDI nitide davvero: l'add-on ora inietta `width`/`height` nell'SVG servito. Le icone MDI
  hanno solo `viewBox` 24x24, quindi il QtSvg del citofono le rasterizzava a 24px e poi le
  ingrandiva (sfocate); le immagini raster erano nitide perche' hanno risoluzione vera. Il citofono
  ora chiede la dimensione reale a schermo (`?s=`), cosi' l'icona viene generata gia' grande.
  NB: il fix e' nel server dell'add-on, quindi va aggiornato/ricostruito l'add-on, non solo il QML.

## 0.8.1

- Icone più nitide sul citofono: l'SVG ora viene rasterizzato alla dimensione reale a schermo
  (`sourceSize`) con smoothing, invece di essere scalato da 24px. Risolve le icone MDI "sgranate".
- Tipografia coerente tra editor e citofono: l'add-on imbarca **Roboto** (regular/bold) e lo usa
  sia nell'editor (`@font-face`) sia nel renderer QML (`FontLoader`), così l'anteprima coincide con
  ciò che appare sul display. Roboto si abbina alle icone Material Design (MDI).

## 0.8.0 — Prima release pubblica

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
