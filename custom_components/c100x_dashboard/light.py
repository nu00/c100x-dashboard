"""Light entity for the intercom's display backlight."""
from __future__ import annotations

import logging

from homeassistant.components.light import ColorMode, LightEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import C100xBacklightCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: C100xBacklightCoordinator = data["backlight_coordinator"]
    async_add_entities([C100xBacklightLight(coordinator, entry, data["url"])])


class C100xBacklightLight(CoordinatorEntity[C100xBacklightCoordinator], LightEntity):
    """Retroilluminazione del display del citofono.

    Lo stato riflette il valore reale (global.screenState) riportato dal QML,
    non un'assunzione — se lo schermo si accende/spegne per timeout naturale
    o per una chiamata in arrivo, l'entità lo segue di conseguenza.
    """

    _attr_has_entity_name = True
    _attr_name = "Retroilluminazione display"
    _attr_icon = "mdi:monitor"
    _attr_color_mode = ColorMode.ONOFF
    _attr_supported_color_modes = {ColorMode.ONOFF}

    def __init__(self, coordinator: C100xBacklightCoordinator, entry: ConfigEntry, base_url: str) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._base = base_url.rstrip("/")
        self._session = async_get_clientsession(coordinator.hass)
        self._attr_unique_id = f"{entry.entry_id}_backlight"

    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data or {}
        return data.get("on")

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    async def _send_command(self, on: bool) -> None:
        try:
            async with self._session.post(
                f"{self._base}/api/backlight-command", json={"on": on}, timeout=10
            ) as resp:
                resp.raise_for_status()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Comando retroilluminazione (%s) fallito: %s", on, err)

    async def async_turn_on(self, **kwargs) -> None:
        await self._send_command(True)
        await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs) -> None:
        await self._send_command(False)
        await self.coordinator.async_request_refresh()
