# Changelog

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
