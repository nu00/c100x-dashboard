import QtQuick 2.0
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

    function imgSource(m) {
        if (m.type === "icon") {
            if (!m.icon) return "";
            var col = (m.color || "#ffffff").toString().replace("#", "");
            return root.addonBase + "/icon/" + m.icon + "?color=" + col;
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

    Rectangle {
        anchors.fill: parent
        color: (root.schedaData && root.schedaData.background) ? root.schedaData.background : "#000000"
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
                visible: modelData.type === "text" || modelData.type === "entity"
                anchors.fill: parent
                color: modelData.color || "white"
                font.pixelSize: modelData.fontSize || 24
                font.bold: modelData.bold ? true : false
                wrapMode: Text.WordWrap
                horizontalAlignment: modelData.align === "center" ? Text.AlignHCenter
                                    : modelData.align === "right" ? Text.AlignRight : Text.AlignLeft
                verticalAlignment: Text.AlignTop
                text: modelData.type === "text" ? (modelData.text || "") : fmtEntity(modelData)
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
                source: root.imgSource(modelData)
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

    // Qualsiasi tasto chiude
    Keys.onReturnPressed: root.back()
    Keys.onUpPressed: root.back()
    Keys.onDownPressed: root.back()
}
