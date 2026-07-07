#!/usr/bin/env node
/*
 * patch-mainpage-qml.js — aggiunge UNA property a MainPage.qml (il menu
 * nativo di default del citofono) che espone la stessa chiamata usata
 * internamente da Keys.onReturnPressed:
 *
 *     Keys.onReturnPressed: listView.currentItem.item.returnPressed()
 *
 * Una "function" dichiarata in un file .qml non e' affidabilmente
 * raggiungibile dall'esterno tramite un riferimento preso da
 * StackView.currentItem (bug/limite QML riscontrato empiricamente sullo
 * stesso identico problema in SchedaPage.qml) — una "property" invece lo e'
 * sempre. Aggiungendo questa property copriamo TUTTE le voci di menu
 * (impostazioni, info, netatmo, spegni, toggle, suoneria...) perche'
 * richiama la funzione vera di qualunque componente sia caricato in quel
 * momento, non una nostra reinterpretazione per singolo caso.
 *
 * Uso: node patch-mainpage-qml.js /path/a/MainPage.qml
 * (nessun secondo argomento necessario: non serve addonBase qui)
 */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
    console.error("Uso: node patch-mainpage-qml.js /path/a/MainPage.qml");
    process.exit(1);
}

const BEGIN = "// BEGIN C100X-HA-MAINPAGE (non rimuovere questo commento)";
const END = "// END C100X-HA-MAINPAGE";

let src = fs.readFileSync(file, "utf8");

if (src.indexOf(BEGIN) >= 0) {
    console.log("MainPage.qml gia' patchato, nessuna modifica necessaria.");
    process.exit(0);
}

const ANCHOR = "property alias count: listView.count";
const anchorIdx = src.indexOf(ANCHOR);
if (anchorIdx < 0) {
    console.error("ERRORE: punto di ancoraggio non trovato in MainPage.qml (il file e' cambiato rispetto a quello atteso?).");
    process.exit(1);
}
const insertAt = anchorIdx + ANCHOR.length;

const BLOCK = `
    ${BEGIN}
    // Espone la stessa chiamata di Keys.onReturnPressed, per la simulazione
    // remota del tasto OK/centrale della rotella (vedi c100x-dashboard).
    property var dashReturnPressed: function() {
        if (listView.currentItem && listView.currentItem.item && listView.currentItem.item.returnPressed)
            listView.currentItem.item.returnPressed();
    }
    ${END}`;

src = src.slice(0, insertAt) + BLOCK + src.slice(insertAt);
fs.writeFileSync(file, src, "utf8");
console.log("MainPage.qml patchato (dashReturnPressed aggiunta).");
