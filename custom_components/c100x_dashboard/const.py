DOMAIN = "c100x_dashboard"

# Topic pubblicati da TcpDump2Mqtt sul citofono (bridge OpenWebNet -> MQTT).
# Se questo bridge non è installato/avviato sul citofono, o se l'integrazione
# MQTT di HA non è configurata, le entità che dipendono da questi topic
# restano semplicemente "unavailable" (vedi binary_sensor.py) invece di
# rompere il setup dell'integrazione.
MQTT_TOPIC_TX = "Bticino/tx"
MQTT_TOPIC_LASTWILL = "Bticino/LastWillT"

# "*8*1...#5#4..." = telecamera accesa (qualunque sia il motivo: squillo reale,
# WebRTC, app locale o remota) — evento a livello di bus, protocollo-agnostico.
# "*8*1#1#4#21*1[016]##" = chiamata esterna in arrivo (qualcuno preme il
# campanello) — pattern dalla tabella OpenWebNet della community
# (github.com/fquinto/bticinoClasse300x#openwebnet-commands): mancava prima,
# per questo un semplice squillo non veniva rilevato come "occupato".
RE_CITOFONO_OCCUPATO = r"^\*8\*1.*#5#4|^\*8\*1#1#4#21\*1[016]##"
# "*7*0*##" = stream chiuso (confermato anche nel bundle.js di c300x-controller).
# "*8*3#5#4*420##" = telecamera spenta, dalla stessa tabella community sopra.
CITOFONO_LIBERO_COMMANDS = ("*7*0*##", "*8*3#5#4*420##")

# Stato "pagina attiva sul display": polling veloce, l'add-on lo tiene già
# in memoria (aggiornato in tempo reale dal QML via /api/scheda-state).
FAST_SCAN_INTERVAL_SECONDS = 2
