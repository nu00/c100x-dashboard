#!/usr/bin/env node
/*
 * patch-scheda-qml.js — inietta/aggiorna in main.qml il watcher che mostra le "schede".
 *
 * Uso:  node patch-scheda-qml.js /percorso/main.qml http://IP_HA:8099 [rendererVersion]
 *
 * Il watcher interroga <addonBase>/active ogni secondo:
 *  - aggiorna schedaData (valori live);
 *  - quando showSeq cambia (comando "Mostra ora" / POST /api/show) accende lo schermo e
 *    mostra SchedaPage; si chiude da sola dopo "duration" secondi (0 = resta);
 *  - quando hideSeq cambia (POST /api/hide) nasconde la scheda.
 *
 * Marcatori BEGIN/END: se il blocco esiste gia' viene SOSTITUITO (aggiornamento pulito).
 * Coesiste con il blocco degli avvisi.
 */

const fs = require("fs");

const BEGIN = "// ===== BEGIN C100X-HA-SCHEDE =====";
const END = "// ===== END C100X-HA-SCHEDE =====";

const path = process.argv[2];
const addonBase = (process.argv[3] || "http://IP_HA:8099").replace(/\/+$/, "");
const rendererVersion = (process.argv[4] || "").trim();
if (!path) { console.error("Uso: node patch-scheda-qml.js /percorso/main.qml http://IP_HA:8099"); process.exit(1); }

const BLOCK = `
    ${BEGIN}
    function reportSchedaState(name) {
        var s = new XMLHttpRequest();
        s.open("POST", schedaWatcher.addonBase + "/api/scheda-state");
        s.setRequestHeader("Content-Type", "application/json");
        s.send(JSON.stringify({ name: name || null }));
    }

    // La simulazione pulsanti via QML e' stata rimossa: la vista live ora
    // usa l'iniettore ptrace sul citofono (endpoint /ptrace-inject del
    // controller), che agisce a livello di syscall — indistinguibile da una
    // pressione fisica vera per il firmware, funziona ovunque (menu nativo
    // incluso), non solo dentro le nostre schede. Qui restano solo le
    // funzioni per la retroilluminazione (entita' light in HA).
    function dashWakeScreen() { global.screenState.enableState(ScreenState.ForcedNormal); }

    // Il report periodico dello stato e' stato tolto da qui: l'add-on ora lo
    // legge direttamente dal sysfs del kernel tramite un endpoint dedicato
    // sul controller (bypassa global.screenState di Qt, che durante/dopo una
    // chiamata in arrivo puo' disallinearsi dalla realta' — osservato).
    // Restano solo i comandi accendi/spegni: azionare davvero lo schermo
    // richiede comunque l'API di Qt, quella parte non si puo' spostare fuori.
    Timer {
        id: backlightPoller
        interval: 300
        running: true
        repeat: true
        onTriggered: {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    try {
                        var d = JSON.parse(xhr.responseText);
                        var cmds = d.commands || [];
                        for (var i = 0; i < cmds.length; i++) {
                            if (cmds[i].on) dashWakeScreen(); else global.turnOffScreen();
                        }
                    } catch (e) {}
                }
            };
            xhr.open("GET", schedaWatcher.addonBase + "/api/backlight-pending");
            xhr.send();
        }
    }
    Component {
        id: schedaPage
        SchedaPage {
            schedaData: schedaWatcher.schedaData
            addonBase: schedaWatcher.addonBase
            autoCloseSeconds: schedaWatcher.duration
            restartToken: schedaWatcher.showSeq
            onBack: { schedaWatcher.showing = false; schedaWatcher.lastReportedName = ""; reportSchedaState(null); global.turnOffScreen() }
            Component.onDestruction: { schedaWatcher.showing = false; schedaWatcher.lastReportedName = ""; reportSchedaState(null); }
        }
    }
    Timer {
        id: schedaWatcher
        interval: 1000
        running: true
        repeat: true
        property string addonBase: "${addonBase}"
        property string rendererVersion: "${rendererVersion}"
        property var schedaData: ({ background: "#000000", elements: [] })
        property int duration: 0
        property real showSeq: 0
        property real lastShowSeq: -1
        property real lastHideSeq: -1
        property bool showing: false
        property string lastReportedName: ""
        onTriggered: {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    try {
                        var d = JSON.parse(xhr.responseText);
                        schedaWatcher.schedaData = { background: d.background, elements: d.elements || [], buttons: d.buttons || null, name: d.name || "" };
                        schedaWatcher.duration = d.duration || 0;
                        var seq = d.showSeq || 0;
                        var hseq = d.hideSeq || 0;
                        if (schedaWatcher.lastShowSeq === -1) {
                            schedaWatcher.lastShowSeq = seq;
                            schedaWatcher.lastHideSeq = hseq;
                        } else {
                            if (seq !== schedaWatcher.lastShowSeq) {
                                schedaWatcher.lastShowSeq = seq;
                                schedaWatcher.showSeq = seq;
                                if (seq > 0 && !vctModel.vct.callInProgress && !schedaWatcher.showing) {
                                    schedaWatcher.showing = true;
                                    global.screenState.enableState(ScreenState.ForcedNormal);
                                    mainStackView.goToPage(schedaPage, "");
                                }
                            }
                            if (hseq !== schedaWatcher.lastHideSeq) {
                                schedaWatcher.lastHideSeq = hseq;
                                if (schedaWatcher.showing) {
                                    schedaWatcher.showing = false;
                                    schedaWatcher.lastReportedName = "";
                                    reportSchedaState(null);
                                    global.turnOffScreen();
                                }
                            }
                        }
                        // Report del nome disaccoppiato dal gate show/hide: cosi' si
                        // aggiorna anche quando una nuova scheda sostituisce quella
                        // gia' visibile (stesso showing=true, nome diverso).
                        if (schedaWatcher.showing) {
                            // Riafferma ForcedNormal ad OGNI ciclo (non solo alla
                            // transizione iniziale non-mostra->mostra): osservato che lo
                            // schermo a volte si spegne da solo mentre una scheda e'
                            // ancora "in mostra" secondo noi — segno che qualche timeout
                            // nativo del citofono puo' annullare la forzatura una volta
                            // sola fatta. Riasserirla ogni secondo la contrasta finche'
                            // la scheda resta davvero visibile.
                            global.screenState.enableState(ScreenState.ForcedNormal);
                            var curName = schedaWatcher.schedaData.name || "scheda";
                            if (curName !== schedaWatcher.lastReportedName) {
                                schedaWatcher.lastReportedName = curName;
                                reportSchedaState(curName);
                            }
                        }
                    } catch (e) {}
                }
            }
            var url = schedaWatcher.addonBase + "/active";
            if (schedaWatcher.rendererVersion) url += "?rv=" + schedaWatcher.rendererVersion;
            xhr.open("GET", url);
            xhr.send();
        }
    }
    ${END}
`;

let c = fs.readFileSync(path, "utf8");

// Sfondo della finestra (backgroundImg): di base si nasconde SOLO durante una
// chiamata reale (callInProgress) — le nostre schede restano trasparenti ma
// non ottengono mai davvero un fb0 pulito sotto, perche' questo sfondo (un
// livello a parte, non nello stack di pagine) resta visibile. Estendiamo la
// stessa condizione aggiungendo "non stiamo mostrando una nostra scheda".
// Idempotente: se gia' presente, non tocca nulla.
const BG_OLD = "visible: !vctModel.vct.callInProgress || onlyAudio";
const BG_NEW = "visible: (!vctModel.vct.callInProgress || onlyAudio) && !schedaWatcher.showing";
if (c.indexOf(BG_NEW) < 0) {
    if (c.indexOf(BG_OLD) >= 0) {
        c = c.replace(BG_OLD, BG_NEW);
        console.log("Sfondo finestra: aggiunta condizione schedaWatcher.showing.");
    } else {
        console.error("ATTENZIONE: binding 'visible' dello sfondo non trovato nella forma attesa — main.qml e' cambiato? Questa patch specifica non e' stata applicata, il resto si'.");
    }
}

const i = c.indexOf(BEGIN), j = c.indexOf(END);
if (i >= 0 && j >= 0) {
    let start = c.lastIndexOf("\n", i); if (start < 0) start = 0;
    let end = j + END.length; if (c[end] === "\n") end++;
    c = c.slice(0, start) + c.slice(end);
    console.log("Blocco schede esistente: aggiornamento.");
}

const idx = c.lastIndexOf("}");
if (idx < 0) { console.error("ERRORE: nessuna graffa di chiusura in main.qml."); process.exit(2); }
c = c.slice(0, idx) + BLOCK + "\n" + c.slice(idx);
fs.writeFileSync(path, c);
console.log("main.qml patchato per le schede (addonBase = " + addonBase + ").");
