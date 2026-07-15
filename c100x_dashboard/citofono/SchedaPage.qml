import QtQuick 2.7
import BtClass100 1.0
import BtObjects 2.0
import Components 1.0

/*
 * SchedaPage.qml — disegna una "scheda" composta nell'editor dell'add-on.
 *
 * Riceve:
 *   - schedaData : oggetto { background, elements: [...] } (aggiornato dal watcher ~1s)
 *   - addonBase  : URL base dell'add-on (es. http://192.168.1.10:8099) per immagini/icone
 *   - autoCloseSeconds : 0 = resta finché non arriva altro / tasto; >0 = si chiude da sola
 *   - restartToken : se cambia, fa ripartire il timer di auto-chiusura
 *
 * I valori delle entità arrivano già risolti dall'add-on (campo .value), quindi
 * si aggiornano dal vivo a ogni poll.
 */
FocusScope {
    id: root

    signal back
    property int count: 1
    property int currentIndex: 0
    property bool menuVisible: false

    property var schedaData: ({ background: "#000000", elements: [] })
    property string addonBase: ""
    property int autoCloseSeconds: 0
    property real restartToken: 0

    function unselectItem() {}

    // Diagnostica tasti: se true, ogni tasto premuto mostra un toast con il suo keycode.
    // Lasciare false in uso normale; accendere solo per capire cosa arriva alla pagina.
    property bool debugKeys: false

    // Font condiviso con l'editor (servito dall'add-on), per coerenza tipografica
    FontLoader { id: robotoReg; source: root.addonBase + "/fonts/Roboto-Regular.ttf" }
    FontLoader { id: robotoBold; source: root.addonBase + "/fonts/Roboto-Bold.ttf" }
    property string uiFont: robotoReg.name ? robotoReg.name : "Sans"

    function imgSource(m, px) {
        if (m.type === "icon") {
            if (!m.icon) return "";
            var col = (m.color || "#ffffff").toString().replace("#", "");
            var u = root.addonBase + "/icon/" + m.icon + "?color=" + col;
            if (px && px > 0) u += "&s=" + Math.round(px);
            return u;
        } else {
            var u = (m.url || "").toString();
            if (u === "") return "";
            if (u.indexOf("http") === 0) return u;
            return root.addonBase + "/" + u;
        }
    }
    function fmtEntity(m) {
        var v = (m.value !== undefined && m.value !== null) ? m.value : "";
        var n = parseFloat(v);
        if (!isNaN(n) && isFinite(v)) v = n.toFixed(m.decimals || 0);
        return (m.prefix || "") + v + (m.suffix || "");
    }

    // Se una o piu' schede contengono elementi "camera", il video viene
    // mostrato a livello di sistema (VPU/JPEG sull'IPU, non un vero elemento
    // QML) — qui dobbiamo solo lasciare quei rettangoli genuinamente
    // trasparenti, non semplicemente disegnarci sopra un colore trasparente
    // (che in Qt rivelerebbe solo altro contenuto QML sotto, non l'hardware
    // framebuffer sottostante — vedi indagine c100x-dashboard).
    //
    // Con piu' telecamere contemporanee, non basta piu' la vecchia
    // scomposizione a 4 fasce fisse (valida solo per UN buco): serve una
    // scomposizione generale. backgroundRects taglia lo schermo in strisce
    // orizzontali ai bordi Y di ogni buco, poi ogni striscia in segmenti ai
    // bordi X dei buchi che la intersecano, scartando i segmenti coperti da
    // un buco — il risultato e' l'insieme di rettangoli che copre "tutto
    // tranne i buchi", qualunque sia il numero di telecamere.
    property var cameraHoles: {
        var arr = [];
        if (!root.schedaData || !root.schedaData.elements) return arr;
        for (var ci = 0; ci < root.schedaData.elements.length; ci++) {
            var ce = root.schedaData.elements[ci];
            if (ce.type === "camera") arr.push({ x: ce.x || 0, y: ce.y || 0, w: ce.w || 10, h: ce.h || 10 });
        }
        return arr;
    }
    property var backgroundRects: {
        var holes = root.cameraHoles;
        if (holes.length === 0) return [{ x: 0, y: 0, w: width, h: height }];
        function uniqSorted(vals) {
            var seen = {}, out = [];
            for (var i = 0; i < vals.length; i++) { var v = vals[i]; if (!seen[v]) { seen[v] = true; out.push(v); } }
            out.sort(function (a, b) { return a - b; });
            return out;
        }
        var ys = [0, height];
        for (var i = 0; i < holes.length; i++) { ys.push(holes[i].y); ys.push(holes[i].y + holes[i].h); }
        ys = uniqSorted(ys);
        var rects = [];
        for (var r = 0; r < ys.length - 1; r++) {
            var y0 = ys[r], y1 = ys[r + 1];
            if (y1 <= y0) continue;
            var midY = (y0 + y1) / 2;
            var xs = [0, width];
            for (i = 0; i < holes.length; i++) {
                var hy = holes[i];
                if (midY >= hy.y && midY < hy.y + hy.h) { xs.push(hy.x); xs.push(hy.x + hy.w); }
            }
            xs = uniqSorted(xs);
            for (var cx = 0; cx < xs.length - 1; cx++) {
                var x0 = xs[cx], x1 = xs[cx + 1];
                if (x1 <= x0) continue;
                var midX = (x0 + x1) / 2;
                var covered = false;
                for (i = 0; i < holes.length; i++) {
                    var hc = holes[i];
                    if (midX >= hc.x && midX < hc.x + hc.w && midY >= hc.y && midY < hc.y + hc.h) { covered = true; break; }
                }
                if (!covered) rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
            }
        }
        return rects;
    }
    property color bgColor: (root.schedaData && root.schedaData.background) ? root.schedaData.background : "#000000"

    Repeater {
        model: root.backgroundRects
        Rectangle {
            x: modelData.x; y: modelData.y
            width: modelData.w; height: modelData.h
            color: root.bgColor
        }
    }

    Repeater {
        model: (root.schedaData && root.schedaData.elements) ? root.schedaData.elements : []

        delegate: Item {
            x: modelData.x || 0
            y: modelData.y || 0
            width: modelData.w || 10
            height: modelData.h || 10
            rotation: modelData.rotation ? modelData.rotation : 0

            // Testo / valore sensore
            Text {
                visible: modelData.type === "text" || modelData.type === "entity" || modelData.type === "template"
                anchors.fill: parent
                color: modelData.color || "white"
                font.family: root.uiFont
                font.pixelSize: modelData.fontSize || 24
                font.bold: modelData.bold ? true : false
                wrapMode: Text.WordWrap
                // Gli elementi "template" arrivano gia' come HTML (markdown convertito):
                // usiamo RichText per renderli; gli altri restano testo semplice.
                textFormat: modelData.rich ? Text.RichText : Text.PlainText
                horizontalAlignment: modelData.align === "center" ? Text.AlignHCenter
                                    : modelData.align === "right" ? Text.AlignRight : Text.AlignLeft
                verticalAlignment: Text.AlignTop
                text: modelData.type === "text" ? (modelData.text || "")
                     : modelData.type === "template" ? (modelData.value || "")
                     : fmtEntity(modelData)
            }

            // Rettangolo
            Rectangle {
                visible: modelData.type === "rect"
                anchors.fill: parent
                color: modelData.fill || "white"
            }

            // Cerchio (ellisse se non quadrato approssimata)
            Rectangle {
                visible: modelData.type === "circle"
                anchors.fill: parent
                radius: Math.min(width, height) / 2
                color: modelData.fill || "white"
            }

            // Triangolo
            Canvas {
                visible: modelData.type === "triangle"
                anchors.fill: parent
                onPaint: {
                    var ctx = getContext("2d");
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = modelData.fill || "white";
                    ctx.beginPath();
                    ctx.moveTo(width / 2, 0);
                    ctx.lineTo(width, height);
                    ctx.lineTo(0, height);
                    ctx.closePath();
                    ctx.fill();
                }
                onVisibleChanged: requestPaint()
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
                Component.onCompleted: requestPaint()
            }

            // Linea
            Rectangle {
                visible: modelData.type === "line"
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width
                height: modelData.thickness || 6
                color: modelData.fill || "white"
            }

            // Freccia (linea + punta)
            Canvas {
                visible: modelData.type === "arrow"
                anchors.fill: parent
                onPaint: {
                    var ctx = getContext("2d");
                    ctx.clearRect(0, 0, width, height);
                    var t = modelData.thickness || 6;
                    var cy = height / 2;
                    var col = modelData.fill || "white";
                    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = t;
                    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(width - t * 2.4, cy); ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(width, cy);
                    ctx.lineTo(width - t * 2.4, cy - t * 1.8);
                    ctx.lineTo(width - t * 2.4, cy + t * 1.8);
                    ctx.closePath(); ctx.fill();
                }
                onVisibleChanged: requestPaint()
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
                Component.onCompleted: requestPaint()
            }

            // Immagine / icona
            Image {
                visible: modelData.type === "image" || modelData.type === "icon"
                anchors.fill: parent
                fillMode: Image.PreserveAspectFit
                cache: true
                smooth: true
                antialiasing: true
                // Rasterizza l'SVG/immagine alla dimensione reale a schermo:
                // senza questo, le icone MDI (viewBox 24x24) venivano scalate da 24px e risultavano sgranate.
                sourceSize.width: Math.max(1, Math.round(width))
                sourceSize.height: Math.max(1, Math.round(height))
                source: root.imgSource(modelData, Math.max(width, height))
            }
        }
    }

    // Auto-chiusura (0 = resta)
    onRestartTokenChanged: {
        autoClose.stop();
        if (root.autoCloseSeconds > 0) { autoClose.interval = root.autoCloseSeconds * 1000; autoClose.restart(); }
    }
    Timer {
        id: autoClose
        interval: Math.max(1, root.autoCloseSeconds) * 1000
        running: root.autoCloseSeconds > 0
        repeat: false
        onTriggered: root.back()
    }

    // ---- Pulsanti configurabili per-scheda ----
    // schedaData.buttons = { "1".."7"|"up"|"down"|"ok": { action:{...}, toast:{text,seconds}, closes:bool } }
    // Un tasto senza voce qui mantiene il comportamento nativo/di default.
    // La rotella (up/down/ok) di default chiude la scheda; se ha un'azione assegnata, la esegue.

    function buttonFor(key) {
        var b = root.schedaData && root.schedaData.buttons ? root.schedaData.buttons : null;
        if (!b) return null;
        return b[key] ? b[key] : null;
    }

    // Invia l'azione al server dell'add-on, che la inoltra a Home Assistant.
    function sendAction(key) {
        if (!root.addonBase) return;
        var xhr = new XMLHttpRequest();
        xhr.open("POST", root.addonBase + "/api/action");
        xhr.setRequestHeader("Content-Type", "application/json");
        var body = { scheda: (root.schedaData && root.schedaData.name) ? root.schedaData.name : "", button: key };
        xhr.send(JSON.stringify(body));
    }

    // Gestione centralizzata di un tasto configurato.
    // Ritorna:
    //   0 = tasto non configurato (il chiamante fa il suo default)
    //   1 = gestito, EVENTO DA ACCETTARE  -> LED spento (illuminazione OFF)
    //   2 = gestito, EVENTO DA NON ACCETTARE -> il firmware accende il LED
    //       (illuminazione ON). NB: su tasti con funzione nativa il firmware
    //       eseguira' ANCHE quella.
    function handleButton(key) {
        var cfg = buttonFor(key);
        if (!cfg) return 0;
        if (cfg.toast && cfg.toast.text) showToast(cfg.toast.text, cfg.toast.seconds || 2);
        if (cfg.action) sendAction(key);
        return cfg.light ? 2 : 1;
    }

    // Toast/placeholder mostrato all'istante alla pressione (testo dal config del tasto).
    function showToast(text, seconds) {
        toastText.text = text;
        toastBox.opacity = 1;
        toastTimer.interval = Math.max(1, seconds) * 1000;
        toastTimer.restart();
    }
    Rectangle {
        id: toastBox
        opacity: 0
        z: 999
        color: "#cc000000"
        radius: 10
        width: Math.min(root.width - 40, toastText.implicitWidth + 40)
        height: toastText.implicitHeight + 24
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 24
        Behavior on opacity { NumberAnimation { duration: 150 } }
        Text {
            id: toastText
            anchors.centerIn: parent
            width: root.width - 60
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
            color: "white"
            font.pixelSize: 26
            font.family: root.uiFont
            text: ""
        }
        Timer { id: toastTimer; repeat: false; onTriggered: toastBox.opacity = 0 }
    }

    // --- Tasti ---
    // Un SOLO Keys.onPressed, nessun focus forzato (lezione 0.9.1): e' la struttura
    // della test-page diagnostica che riceve correttamente tutti i tasti.
    //
    // Per ogni tasto configurato, handleButton() decide se l'evento va ACCETTATO:
    //   - illuminazione OFF -> accettiamo -> il LED del tasto NON si accende;
    //   - illuminazione ON  -> NON accettiamo -> il firmware accende il LED (e, se il
    //     tasto ha una funzione nativa, la esegue anche).
    // I tasti NON configurati mantengono il comportamento nativo (rotella = chiudi).
    // Rotella: se il tasto ha un'azione la esegue, altrimenti chiude la scheda.
    // Funzione a se' stante (non solo codice in Keys.onPressed) cosi' anche la
    // simulazione da remoto puo' chiamarla e ottenere ESATTAMENTE lo stesso
    // comportamento, invece di doverlo reimplementare a parte.
    function handleWheelKey(key) {
        var rr = handleButton(key);
        if (rr === 0) root.back(); // non configurato: chiudi (0.8.0)
        return rr;
    }

    // Le "function" dichiarate qui non sono affidabilmente raggiungibili da
    // fuori file tramite un riferimento preso da StackView.currentItem (bug/
    // limite QML riscontrato empiricamente: il tasto fisico funziona perche'
    // la chiamata resta interna a questo stesso file, ma dall'esterno la
    // property risulta assente). Una "property" invece e' sempre raggiungibile:
    // la usiamo per esporre le stesse funzioni alla simulazione da remoto.
    property var dashHandleButton: handleButton
    property var dashHandleWheelKey: handleWheelKey

    Keys.onPressed: {
        if (root.debugKeys) { showToast("key=" + event.key + " text='" + event.text + "'", 2); return; }
        // Tasti carattere del frontalino: '1'..'7'
        var txt = event.text;
        if (txt && txt.length === 1 && txt >= "1" && txt <= "7") {
            var r = handleButton(txt);
            if (r === 1) event.accepted = true;   // gestito, LED spento
            // r === 2: gestito ma lasciamo passare (LED acceso); r === 0: non nostro
            return;
        }
        // Rotella: OK/su/giu per keycode Qt.
        var rr = 0;
        if (event.key === 16777220) rr = handleWheelKey("ok");        // Qt.Key_Return / OK
        else if (event.key === 16777235) rr = handleWheelKey("up");   // Qt.Key_Up
        else if (event.key === 16777237) rr = handleWheelKey("down"); // Qt.Key_Down
        else if (event.key === 17825797) {                          // cornetta destra (riaggancia)
            // Le cornette hanno funzione telefonica nativa fortissima: eseguiamo
            // l'eventuale azione HA ma NON accettiamo mai l'evento, così il firmware
            // continua a gestire la cornetta come di default.
            handleButton("phone_right");
            return;
        }
        else if (event.key === 17825796) {                          // cornetta sinistra (rispondi), scan=226
            handleButton("phone_left");
            return;
        }
        else return;
        if (rr === 1) event.accepted = true;      // gestito, LED spento
        // rr === 0: root.back() gia' chiamato dentro handleWheelKey()
        // rr === 2: gestito, lasciamo passare (LED acceso, e il firmware fa il resto)
    }
}
