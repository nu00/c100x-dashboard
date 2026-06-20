# Changelog

Tutte le versioni rilevanti del progetto. Le versioni si riferiscono all'add-on,
salvo dove indicato per l'integrazione.

## Integrazione 1.0.0
- Integrazione Home Assistant con config flow (UI) e servizi `c100x_dashboard.show`,
  `c100x_dashboard.hide`, `c100x_dashboard.set_active` per richiamare le schede dalle
  automazioni passando il nome (e la durata).

## Add-on 0.8.0
- Interfaccia editor tradotta (IT/EN) con selettore lingua e auto-rilevamento del browser.
- Nuovo endpoint `POST /api/hide` e `POST /api/show` ora accetta anche `name` (una sola chiamata).
- Il watcher del citofono gestisce l'evento di "hide"; la patch ora **aggiorna** il blocco
  invece di saltarlo (ogni "Installa" applica le novità).

## Add-on 0.7.x
- 0.7.2: cache-busting degli asset (niente più JS vecchio in cache dopo gli aggiornamenti).
- 0.7.1: header `no-cache` sull'interfaccia.
- 0.7.0: **installazione automatica sul citofono via SSH** (pulsante "Citofono"): upload di
  `SchedaPage.qml`, patch di `main.qml` con backup e riavvio. Spunta per salvare o meno la
  password. Algoritmi legacy del dropbear, upload senza sftp.

## Add-on 0.6.0
- Lato citofono completo: `SchedaPage.qml` disegna tutti gli elementi (testo, valore live,
  immagine, icona, forme, linea, freccia, con rotazione). Endpoint `/api/show` + pulsante
  "Mostra ora" con durata.

## Add-on 0.5.x
- 0.5.1: fix delle guide di allineamento (si staccavano dal DOM); guide tratteggiate e colorate
  per tipo (centri/bordi).
- 0.5.0: rotazione con maniglia stile Word; guide di allineamento (snap a elementi e centri schermo).

## Add-on 0.4.0
- Rotazione degli elementi; elementi linea e freccia; upload immagini e scelta da `config/www`;
  icone già in uso dalle entità; interfaccia integrata in HA via Ingress.

## Add-on 0.3.0
- Trascinamento/ridimensionamento fluidi; autocomplete entità (stile Node-RED); elemento icona
  con autocomplete MDI servite come SVG.

## Add-on 0.2.0
- Primo editor drag-and-drop funzionante con salvataggio dei layout.
