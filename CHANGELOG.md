# Changelog

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
