"""Binary sensor entities driven by MQTT (TcpDump2Mqtt bridge on the intercom).

Questi sensori dipendono da un pezzo di infrastruttura opzionale e fuori dal
nostro controllo diretto:
- l'integrazione MQTT di Home Assistant deve essere configurata;
- il bridge TcpDump2Mqtt deve essere installato e avviato sul citofono.

Nessuna delle due condizioni è garantita, quindi entrambe le entità qui sotto
degradano in modo esplicito (available=False, con il motivo nei log e negli
attributi) invece di rompere il setup dell'integrazione o mostrare uno stato
falso/fuorviante.
"""
from __future__ import annotations

import logging
import re

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CITOFONO_LIBERO_COMMANDS,
    DOMAIN,
    MQTT_TOPIC_LASTWILL,
    MQTT_TOPIC_TX,
    RE_CITOFONO_OCCUPATO,
)

_LOGGER = logging.getLogger(__name__)

_RE_OCCUPATO = re.compile(RE_CITOFONO_OCCUPATO)


def _mqtt_configured(hass: HomeAssistant) -> bool:
    """True se l'integrazione MQTT di HA risulta configurata e caricata."""
    return "mqtt" in hass.config.components


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    mqtt_ok = _mqtt_configured(hass)
    if not mqtt_ok:
        _LOGGER.warning(
            "Integrazione MQTT non configurata in Home Assistant: "
            "'Citofono occupato' e 'Ponte MQTT online' resteranno non disponibili "
            "finché non configuri MQTT (Impostazioni > Dispositivi e servizi > Aggiungi > MQTT)."
        )
    async_add_entities([
        C100xCitofonoOccupatoSensor(entry, mqtt_ok),
        C100xMqttBridgeOnlineSensor(entry, mqtt_ok),
    ])


class _MqttFallbackBinarySensor(BinarySensorEntity):
    """Base comune: gestisce l'iscrizione MQTT e il fallback se non disponibile."""

    _attr_has_entity_name = True
    _mqtt_topic: str

    def __init__(self, entry: ConfigEntry, mqtt_ok: bool, unique_suffix: str) -> None:
        self._entry = entry
        self._mqtt_ok = mqtt_ok
        self._attr_unique_id = f"{entry.entry_id}_{unique_suffix}"
        self._attr_is_on = None
        self._unsub = None
        self._subscribe_failed = False

    @property
    def available(self) -> bool:
        if not self._mqtt_ok:
            return False
        if self._subscribe_failed:
            return False
        return True

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "mqtt_integration_configured": self._mqtt_ok,
            "mqtt_topic": self._mqtt_topic,
        }

    async def async_added_to_hass(self) -> None:
        if not self._mqtt_ok:
            return
        from homeassistant.components import mqtt  # import locale: opzionale

        try:
            self._unsub = await mqtt.async_subscribe(
                self.hass, self._mqtt_topic, self._mqtt_message_received, qos=0
            )
        except Exception as err:  # noqa: BLE001
            self._subscribe_failed = True
            _LOGGER.warning(
                "Sottoscrizione MQTT al topic '%s' fallita: %s", self._mqtt_topic, err
            )

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    @callback
    def _mqtt_message_received(self, msg) -> None:
        raise NotImplementedError


class C100xCitofonoOccupatoSensor(_MqttFallbackBinarySensor):
    """On quando il citofono sta usando la telecamera (qualunque sia la causa:
    squillo reale, WebRTC, app locale o remota) — rilevato a livello di bus
    OpenWebNet via il bridge TcpDump2Mqtt (topic Bticino/tx), non a livello
    di rete: copre quindi anche l'accesso via LTE remoto.
    """

    _attr_name = "Citofono occupato"
    _attr_icon = "mdi:phone-in-talk"
    _attr_device_class = BinarySensorDeviceClass.OCCUPANCY
    _mqtt_topic = MQTT_TOPIC_TX

    def __init__(self, entry: ConfigEntry, mqtt_ok: bool) -> None:
        super().__init__(entry, mqtt_ok, "citofono_occupato")
        # Bticino/tx non e' un topic "retained": senza un default, il sensore
        # resterebbe "unknown" a tempo indefinito finche' non capita un vero
        # evento. Assumiamo "libero" finche' non arriva prova contraria.
        self._attr_is_on = False

    @callback
    def _mqtt_message_received(self, msg) -> None:
        payload = (msg.payload or "").strip()
        if not payload:
            return
        if payload in CITOFONO_LIBERO_COMMANDS:
            self._attr_is_on = False
            self.async_write_ha_state()
        elif _RE_OCCUPATO.match(payload):
            self._attr_is_on = True
            self.async_write_ha_state()
        # Altri comandi (dettagli apertura stream audio/video, ecc.) sono
        # rumore rispetto a questo sensore: li ignoriamo di proposito.


class C100xMqttBridgeOnlineSensor(_MqttFallbackBinarySensor):
    """On quando il bridge TcpDump2Mqtt sul citofono è online (Last Will MQTT).

    Utile per sapere quando il bridge non è ripartito bene dopo un riavvio
    del citofono (bug noto: a volte parte prima che il WiFi abbia un
    gateway e si chiude subito) — senza questo sensore, 'Citofono occupato'
    sopra smetterebbe silenziosamente di aggiornarsi.
    """

    _attr_name = "Ponte MQTT citofono online"
    _attr_icon = "mdi:lan-connect"
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _mqtt_topic = MQTT_TOPIC_LASTWILL

    def __init__(self, entry: ConfigEntry, mqtt_ok: bool) -> None:
        super().__init__(entry, mqtt_ok, "mqtt_bridge_online")

    @callback
    def _mqtt_message_received(self, msg) -> None:
        payload = (msg.payload or "").strip().lower()
        if payload == "online":
            self._attr_is_on = True
        elif payload == "offline":
            self._attr_is_on = False
        else:
            return
        self.async_write_ha_state()
