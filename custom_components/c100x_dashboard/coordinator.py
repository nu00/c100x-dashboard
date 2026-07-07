"""Polling coordinator for the C100X Dashboard add-on status."""
from __future__ import annotations

from datetime import timedelta
import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import FAST_SCAN_INTERVAL_SECONDS

_LOGGER = logging.getLogger(__name__)

# Renderer status lives in the add-on; poll it on a relaxed cadence.
SCAN_INTERVAL = timedelta(seconds=30)


class C100xStatusCoordinator(DataUpdateCoordinator[dict]):
    """Fetch /api/citofono/status from the add-on."""

    def __init__(self, hass: HomeAssistant, base_url: str) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name="c100x_dashboard_status",
            update_interval=SCAN_INTERVAL,
        )
        self._base = base_url.rstrip("/")
        self._session = async_get_clientsession(hass)

    @property
    def base_url(self) -> str:
        return self._base

    async def _async_update_data(self) -> dict:
        try:
            async with self._session.get(
                f"{self._base}/api/citofono/status", timeout=15
            ) as resp:
                resp.raise_for_status()
                return await resp.json()
        except Exception as err:  # noqa: BLE001
            raise UpdateFailed(f"status fetch failed: {err}") from err


class C100xActiveSchedaCoordinator(DataUpdateCoordinator[dict]):
    """Fetch /api/scheda-state from the add-on: cosa è davvero mostrato sul display.

    Polling veloce (pochi secondi) perché è pensato per riflettere lo stato in
    tempo reale — l'add-on lo tiene già aggiornato in memoria (push dal QML),
    quindi qui stiamo solo interrogando una cache locale, non il citofono
    direttamente: nessun impatto sul citofono stesso.
    """

    def __init__(self, hass: HomeAssistant, base_url: str) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name="c100x_dashboard_pagina_attiva",
            update_interval=timedelta(seconds=FAST_SCAN_INTERVAL_SECONDS),
        )
        self._base = base_url.rstrip("/")
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> dict:
        try:
            async with self._session.get(
                f"{self._base}/api/scheda-state", timeout=10
            ) as resp:
                resp.raise_for_status()
                return await resp.json()
        except Exception as err:  # noqa: BLE001
            raise UpdateFailed(f"scheda-state fetch failed: {err}") from err
