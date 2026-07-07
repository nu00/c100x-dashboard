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
RE_CITOFONO_OCCUPATO = r"^\*8\*1.*#5#4"
# "*7*0*##" = stream chiuso (confermato anche nel bundle.js di c300x-controller).
CMD_CITOFONO_LIBERO = "*7*0*##"

# Stato "pagina attiva sul display": polling veloce, l'add-on lo tiene già
# in memoria (aggiornato in tempo reale dal QML via /api/scheda-state).
FAST_SCAN_INTERVAL_SECONDS = 2
