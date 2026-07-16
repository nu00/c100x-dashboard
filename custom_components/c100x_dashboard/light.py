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

    Lo stato riflette il valore reale letto direttamente dal sysfs (non lo
    stato interno di Qt, che puo' disallinearsi dalla realta'). Accensione,
    spegnimento e luminosita' agiscono SOLO sulla retroilluminazione fisica
    (blank + brightness via sysfs) — mai tramite un comando a QML, che come
    effetto collaterale chiuderebbe la scheda eventualmente mostrata in quel
    momento. Questa entita' esiste per controllare la luce, non la GUI.
    """

    _attr_has_entity_name = True
    _attr_name = "Retroilluminazione display"
    _attr_icon = "mdi:monitor"
    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}

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
    def brightness(self) -> int | None:
        # L'add-on riporta un livello 0-100 (percentuale reale del sysfs);
        # HA vuole 0-255.
        data = self.coordinator.data or {}
        level = data.get("level")
        if level is None:
            return None
        return round(level * 255 / 100)

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    async def _send_command(self, on: bool, level_pct: int | None = None) -> None:
        payload = {"on": on}
        if on and level_pct is not None:
            payload["level"] = level_pct
        try:
            async with self._session.post(
                f"{self._base}/api/backlight-force", json=payload, timeout=10
            ) as resp:
                resp.raise_for_status()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Comando retroilluminazione (%s) fallito: %s", payload, err)

    async def async_turn_on(self, **kwargs) -> None:
        level_pct = None
        if "brightness" in kwargs:
            # HA manda 0-255, l'add-on/sysfs vuole 0-100
            level_pct = max(1, round(kwargs["brightness"] * 100 / 255))
        await self._send_command(True, level_pct)
        await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs) -> None:
        await self._send_command(False)
        await self.coordinator.async_request_refresh()
