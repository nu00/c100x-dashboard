# Lato citofono — disegnare le schede sul display

Questa cartella contiene il pezzo che gira **sul citofono** (BTicino Classe 100X) e che
disegna sul display le schede composte nell'editor dell'add-on.

> Per ora l'installazione è **manuale** (come per la funzione "avvisi"). L'auto-provisioning
> via SSH dall'add-on è il passo successivo.

## Come funziona

Un `Timer` iniettato in `main.qml` interroga `http://<add-on>:8099/active` ogni secondo:

- aggiorna i valori (le entità si aggiornano **dal vivo** mentre la scheda è a video);
- quando arriva un comando **"Mostra ora"** (dall'editor o da Node-RED via `POST /api/show`),
  accende lo schermo e mostra `SchedaPage.qml` con la scheda attiva;
- la scheda si chiude da sola dopo la durata impostata (0 = resta finché non ne arriva
  un'altra o premi un tasto).

`SchedaPage.qml` disegna tutti i tipi dell'editor: testo, valore sensore, immagine, icona,
rettangolo, cerchio, triangolo, linea, freccia, con rotazione.

## Installazione manuale

Prerequisito: l'add-on "C100X Dashboard" installato e funzionante, e l'IP di Home Assistant
(dove gira l'add-on, porta 8099). Serve accesso SSH al citofono.

1. **Copia `SchedaPage.qml`** nello skin della GUI:

   ```sh
   mount -oremount,rw /
   cp SchedaPage.qml /home/bticino/bin/gui/skins/default/SchedaPage.qml
   mount -oremount,ro /
   ```

   (oppure incollalo con `cat > /home/bticino/bin/gui/skins/default/SchedaPage.qml << 'QML' … QML`)

2. **Patcha `main.qml`** indicando l'URL dell'add-on (sostituisci con l'IP del tuo HA):

   ```sh
   mount -oremount,rw /
   cp /home/bticino/bin/gui/skins/default/main.qml /home/bticino/cfg/extra/main.qml.bak.prescheda
   /home/bticino/cfg/extra/node/bin/node patch-scheda-qml.js \
       /home/bticino/bin/gui/skins/default/main.qml http://IP_HA:8099
   mount -oremount,ro /
   ```

   Il blocco ha marcatori `BEGIN/END C100X-HA-SCHEDE` e **coesiste** con quello degli avvisi.

3. **Riavvia** per ricaricare la GUI:

   ```sh
   reboot
   ```

## Uso

Dall'editor dell'add-on: componi/seleziona una scheda, imposta la durata e premi
**"Mostra ora"**. Entro ~1 secondo compare sul citofono.

Da Node-RED: imposta la scheda attiva e mostrala con due chiamate HTTP all'add-on:

```
POST http://IP_HA:8099/api/active   body {"name":"consumi"}
POST http://IP_HA:8099/api/show     body {"duration":0}     // 0 = resta a video
```

Mentre la scheda è mostrata, i valori dei sensori si aggiornano da soli ogni secondo —
utile per consumo istantaneo, percentuale UPS durante un blackout, ecc.

## Disinstallazione

```sh
mount -oremount,rw /
/home/bticino/cfg/extra/node/bin/node unpatch-scheda-qml.js /home/bticino/bin/gui/skins/default/main.qml
rm -f /home/bticino/bin/gui/skins/default/SchedaPage.qml
mount -oremount,ro /
reboot
```

## Note

- L'`addonBase` (URL dell'add-on) viene scritto nel blocco di `main.qml`. Se cambia l'IP di
  HA, ri-patcha (dopo unpatch) con il nuovo URL.
- Immagini e icone vengono scaricate **dall'add-on** in HTTP (un solo host), quindi il
  citofono non deve raggiungere altri server né usare HTTPS.
- Il rendering di triangoli e frecce usa `Canvas`, e le icone/immagini usano `Image` (SVG
  incluso): se sul tuo firmware qualcosa non si disegna, segnalalo — potrebbe servire un
  ritocco (è la parte meno collaudata).
