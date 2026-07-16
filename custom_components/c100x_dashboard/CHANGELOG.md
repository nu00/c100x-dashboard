# Changelog — integrazione Home Assistant

Questo file copre la sola integrazione Home Assistant (`custom_components/c100x_dashboard`,
versione in `manifest.json`). Per le novità dell'add-on (editor, visualizzazione live,
installazione sul citofono) vedi [c100x_dashboard/CHANGELOG.md](../../c100x_dashboard/CHANGELOG.md).

This file covers only the Home Assistant integration (`custom_components/c100x_dashboard`,
version in `manifest.json`). For add-on news (editor, live view, intercom install) see
[c100x_dashboard/CHANGELOG.md](../../c100x_dashboard/CHANGELOG.md).

---

## 1.4.1

**🇮🇹 Italiano**

- **Dimmerabile**: l'entità supporta ora la regolazione della luminosità, non solo acceso/spento.
- **Corretto un effetto collaterale serio**: spegnere la retroilluminazione da questa entità chiudeva la scheda mostrata sul citofono in quel momento. Ora agisce esclusivamente sulla retroilluminazione fisica, senza alcun effetto sulla GUI mostrata.

**🇬🇧 English**

- **Dimmable**: the entity now supports brightness adjustment, not just on/off.
- **Fixed a serious side effect**: turning off the backlight from this entity closed whatever screen the intercom was showing at the time. It now acts exclusively on the physical backlight, with no effect on the shown GUI.

## 1.4.0

**🇮🇹 Italiano**

- **L'entità di aggiornamento aspetta il riavvio del citofono**: prima si considerava conclusa subito dopo l'invio dei file, mentre il citofono era ancora in fase di riavvio (l'installazione lo riavvia sempre a fine flusso) — rischiando di sovrapporre due installazioni se richiamata di nuovo troppo presto. Ora aspetta (fino a 3 minuti) che il citofono torni online con la versione nuova prima di considerarsi davvero conclusa.

**🇬🇧 English**

- **The update entity now waits for the intercom to reboot**: previously it considered itself done right after sending the files, while the intercom was still rebooting (install always reboots it at the end) — risking overlapping installs if triggered again too soon. It now waits (up to 3 minutes) for the intercom to come back online with the new version before considering itself truly done.

## 1.3.0

**🇮🇹 Italiano**

- **Nuova entità `light.retroilluminazione_display`**: rappresenta la retroilluminazione del display del citofono. Lo stato riflette quello reale (letto ogni ~2 secondi tramite un coordinator dedicato), e può essere accesa/spenta direttamente da Home Assistant o da un'automazione.

**🇬🇧 English**

- **New `light.retroilluminazione_display` entity**: represents the intercom display's backlight. State reflects the real one (read every ~2 seconds via a dedicated coordinator), and can be turned on/off directly from Home Assistant or an automation.

## 1.2.0

**🇮🇹 Italiano**

- **Nuove entità**: `sensor.pagina_attiva` (quale scheda è mostrata sul display in questo momento, `idle` se libero) e `binary_sensor.citofono_occupato` (on quando la telecamera è in uso, per qualsiasi motivo — squillo reale, WebRTC, app locale o via LTE).
- **Rilevamento occupato via MQTT (opzionale)**: `citofono_occupato` può leggere il topic `Bticino/tx` pubblicato dal bridge [TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x), se installato sul citofono. Aggiunta anche `binary_sensor.ponte_mqtt_citofono_online`. Se MQTT non è configurato in HA, o il bridge non è installato/avviato, le due entità degradano in modo esplicito (`unavailable`/default sicuro) invece di rompere l'integrazione.
- Aggiunta dipendenza opzionale (`after_dependencies`) dall'integrazione MQTT di Home Assistant.

**🇬🇧 English**

- **New entities**: `sensor.pagina_attiva` (which screen is currently shown on the display, `idle` when free) and `binary_sensor.citofono_occupato` (on while the camera is in use, for any reason — a real ring, WebRTC, the local app, or over LTE).
- **MQTT-based occupancy detection (optional)**: `citofono_occupato` can read the `Bticino/tx` topic published by the [TcpDump2Mqtt](https://github.com/fquinto/bticinoClasse300x) bridge, if installed on the intercom. Also added `binary_sensor.ponte_mqtt_citofono_online`. If MQTT isn't configured in HA, or the bridge isn't installed/running, both entities degrade explicitly (`unavailable`/safe default) instead of breaking the integration.
- Added an optional dependency (`after_dependencies`) on Home Assistant's MQTT integration.

## 1.1.0

**🇮🇹 Italiano**

- **Entità Update**: notifica in Home Assistant quando il renderer QML installato sul citofono non è allineato con quello dell'add-on, con pulsante per lanciare l'aggiornamento.

**🇬🇧 English**

- **Update entity**: notifies in Home Assistant when the QML renderer installed on the intercom isn't aligned with the add-on's, with a button to trigger the update.

## 1.0.0

**🇮🇹 Italiano**

Prima pubblicazione dell'integrazione.

- Config flow via interfaccia utente (nessuna configurazione YAML necessaria).
- Servizi `c100x_dashboard.show`, `c100x_dashboard.hide`, `c100x_dashboard.set_active` per richiamare le schede dalle automazioni per nome (e durata opzionale).
- Icona locale dell'integrazione in `brand/` (Home Assistant 2026.3+).

**🇬🇧 English**

First release of the integration.

- UI-based config flow (no YAML configuration needed).
- `c100x_dashboard.show`, `c100x_dashboard.hide`, `c100x_dashboard.set_active` services to recall screens from automations by name (and optional duration).
- Local integration icon in `brand/` (Home Assistant 2026.3+).
