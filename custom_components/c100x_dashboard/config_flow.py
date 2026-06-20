"""Config flow for C100X Dashboard."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN


class C100xDashboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Ask for the add-on URL and verify it answers."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors: dict[str, str] = {}
        if user_input is not None:
            url = user_input["url"].rstrip("/")
            ok = False
            try:
                session = async_get_clientsession(self.hass)
                async with session.get(f"{url}/health", timeout=10) as resp:
                    ok = resp.status == 200
            except Exception:  # noqa: BLE001
                ok = False
            if ok:
                await self.async_set_unique_id(url)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="C100X Dashboard", data={"url": url})
            errors["base"] = "cannot_connect"

        schema = vol.Schema({vol.Required("url", default="http://homeassistant.local:8099"): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
