"""C100X Dashboard — services to control the intercom screens via the add-on."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN

SHOW_SCHEMA = vol.Schema({
    vol.Optional("name"): cv.string,
    vol.Optional("duration", default=0): vol.All(vol.Coerce(int), vol.Range(min=0)),
})
SET_ACTIVE_SCHEMA = vol.Schema({vol.Required("name"): cv.string})


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry and register the services."""
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry.data["url"].rstrip("/")
    session = async_get_clientsession(hass)

    async def _post(path: str, payload: dict) -> None:
        base = next(iter(hass.data[DOMAIN].values()))
        async with session.post(f"{base}{path}", json=payload, timeout=15) as resp:
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

    hass.services.async_register(DOMAIN, "show", show, schema=SHOW_SCHEMA)
    hass.services.async_register(DOMAIN, "hide", hide)
    hass.services.async_register(DOMAIN, "set_active", set_active, schema=SET_ACTIVE_SCHEMA)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and remove services if it was the last one."""
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if not hass.data.get(DOMAIN):
        for svc in ("show", "hide", "set_active"):
            hass.services.async_remove(DOMAIN, svc)
    return True
