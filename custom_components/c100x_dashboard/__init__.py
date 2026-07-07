"""C100X Dashboard — services + intercom-renderer update entity, via the add-on."""
from __future__ import annotations

import logging

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN
from .coordinator import C100xActiveSchedaCoordinator, C100xStatusCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.UPDATE, Platform.SENSOR, Platform.BINARY_SENSOR]

SHOW_SCHEMA = vol.Schema({
    vol.Optional("name"): cv.string,
    vol.Optional("duration", default=0): vol.All(vol.Coerce(int), vol.Range(min=0)),
})
SET_ACTIVE_SCHEMA = vol.Schema({vol.Required("name"): cv.string})


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry: store base URL, start coordinator, register services."""
    base = entry.data["url"].rstrip("/")

    coordinator = C100xStatusCoordinator(hass, base)
    await coordinator.async_config_entry_first_refresh()

    active_scheda_coordinator = C100xActiveSchedaCoordinator(hass, base)
    try:
        await active_scheda_coordinator.async_config_entry_first_refresh()
    except Exception as err:  # noqa: BLE001
        # Non blocchiamo il setup dell'intera integrazione per questo: è un
        # sensore accessorio, riproverà da solo secondo il suo scan interval.
        _LOGGER.warning("Primo fetch di /api/scheda-state fallito: %s", err)

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "url": base,
        "coordinator": coordinator,
        "active_scheda_coordinator": active_scheda_coordinator,
    }

    session = async_get_clientsession(hass)

    async def _post(path: str, payload: dict) -> None:
        # Use this entry's base URL (first registered is fine for single-add-on setups).
        target = next(iter(hass.data[DOMAIN].values()))["url"]
        async with session.post(f"{target}{path}", json=payload, timeout=15) as resp:
            resp.raise_for_status()

    async def show(call: ServiceCall) -> None:
        payload = {"duration": call.data.get("duration", 0)}
        if call.data.get("name"):
            payload["name"] = call.data["name"]
        await _post("/api/show", payload)

    async def hide(call: ServiceCall) -> None:
        await _post("/api/hide", {})

    async def set_active(call: ServiceCall) -> None:
        await _post("/api/active", {"name": call.data["name"]})

    # Register services once (first entry).
    if not hass.services.has_service(DOMAIN, "show"):
        hass.services.async_register(DOMAIN, "show", show, schema=SHOW_SCHEMA)
        hass.services.async_register(DOMAIN, "hide", hide)
        hass.services.async_register(DOMAIN, "set_active", set_active, schema=SET_ACTIVE_SCHEMA)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry; remove services when the last one goes away."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        if not hass.data.get(DOMAIN):
            for svc in ("show", "hide", "set_active"):
                hass.services.async_remove(DOMAIN, svc)
    return unloaded
