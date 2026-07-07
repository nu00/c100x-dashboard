#!/usr/bin/env node
/* unpatch-mainpage-qml.js — rimuove la property dashReturnPressed da MainPage.qml. */
const fs = require("fs");
const BEGIN = "// BEGIN C100X-HA-MAINPAGE (non rimuovere questo commento)";
const END = "// END C100X-HA-MAINPAGE";
const path = process.argv[2];
if (!path) { console.error("Uso: node unpatch-mainpage-qml.js /percorso/MainPage.qml"); process.exit(1); }
let c = fs.readFileSync(path, "utf8");
const i = c.indexOf(BEGIN), j = c.indexOf(END);
if (i < 0 || j < 0) { console.log("Nessun blocco trovato."); process.exit(0); }
let start = c.lastIndexOf("\n", i); if (start < 0) start = 0;
let end = j + END.length; if (c[end] === "\n") end++;
c = c.slice(0, start) + c.slice(end);
fs.writeFileSync(path, c);
console.log("Blocco rimosso da MainPage.qml.");
