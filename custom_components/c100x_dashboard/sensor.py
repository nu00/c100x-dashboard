"""Sensor entities for C100X Dashboard."""
from __future__ import annotations

import logging

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import C100xActiveSchedaCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: C100xActiveSchedaCoordinator = hass.data[DOMAIN][entry.entry_id][
        "active_scheda_coordinator"
    ]
    async_add_entities([C100xPaginaAttivaSensor(coordinator, entry)])


class C100xPaginaAttivaSensor(CoordinatorEntity[C100xActiveSchedaCoordinator], SensorEntity):
    """Cosa è davvero mostrato sul display del citofono in questo momento.

    Valore "idle" quando lo schermo è libero (home, o dopo chiusura manuale
    con la rotella laterale, o dopo un'interruzione da chiamata reale);
    altrimenti il nome della scheda attiva.
    """

    _attr_has_entity_name = True
    _attr_name = "Pagina attiva"
    _attr_icon = "mdi:monitor-dashboard"

    def __init__(self, coordinator: C100xActiveSchedaCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_pagina_attiva"

    @property
    def native_value(self) -> str | None:
        data = self.coordinator.data or {}
        return data.get("state") or "idle"

    @property
    def available(self) -> bool:
        # Se l'add-on stesso non risponde, l'entità va unavailable per davvero
        # (non "idle" — quello significherebbe "so che è libero", cosa diversa
        # da "non so cosa stia succedendo perché l'add-on non risponde").
        return self.coordinator.last_update_success
