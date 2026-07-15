"""Update entity: keeps the intercom renderer (SchedaPage.qml) in sync with the add-on."""
from __future__ import annotations

import asyncio
import logging

from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import C100xStatusCoordinator

_LOGGER = logging.getLogger(__name__)

# L'installazione fa riavviare il citofono a fine flusso (vedi server.js,
# comando di reboot in coda a /api/citofono/install) — se consideriamo
# l'operazione "conclusa" subito dopo la risposta HTTP, il citofono e' ancora
# in fase di riavvio: un secondo tentativo (manuale o automatico) partirebbe
# mentre il primo non e' nemmeno finito, rischiando di mandare comandi SSH
# concorrenti sullo stesso dispositivo a meta' riavvio. Aspettiamo che
# ricompaia online CON la versione nuova prima di davvero considerarci finiti.
POST_INSTALL_POLL_INTERVAL_S = 5
POST_INSTALL_TIMEOUT_S = 180  # tempo generoso per un riavvio completo del citofono


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: C100xStatusCoordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    async_add_entities([C100xRendererUpdate(coordinator, entry)])


class C100xRendererUpdate(CoordinatorEntity[C100xStatusCoordinator], UpdateEntity):
    """Shows when the intercom-side renderer differs from the one shipped by the add-on."""

    _attr_has_entity_name = True
    _attr_name = "Intercom renderer"
    _attr_entity_category = EntityCategory.CONFIG
    _attr_supported_features = UpdateEntityFeature.INSTALL
    _attr_title = "C100X intercom renderer"

    def __init__(self, coordinator: C100xStatusCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_renderer_update"
        self._installing = False

    @property
    def _data(self) -> dict:
        return self.coordinator.data or {}

    @property
    def installed_version(self) -> str | None:
        # 'deployed' is what the intercom last reported; null/legacy -> not yet installed.
        d = self._data
        if d.get("state") == "legacy":
            return "0"
        return d.get("deployed")

    @property
    def latest_version(self) -> str | None:
        return self._data.get("shipped")

    @property
    def available(self) -> bool:
        # Keep the entity usable even when offline, but reflect reachability.
        return self.coordinator.last_update_success

    @property
    def in_progress(self) -> bool:
        return self._installing

    @property
    def extra_state_attributes(self) -> dict:
        d = self._data
        return {
            "intercom_state": d.get("state"),
            "online": d.get("online"),
            "can_install": d.get("canInstall"),
            "last_seen": d.get("lastSeen"),
        }

    async def async_install(self, version: str | None, backup: bool, **kwargs) -> None:
        d = self._data
        if not d.get("canInstall"):
            raise RuntimeError(
                "Add-on can't install over SSH: set the intercom host and save the "
                "SSH password in the editor (Intercom panel) first."
            )
        target_version = version or self.latest_version
        session = self.coordinator._session  # reuse HA's shared session
        base = self.coordinator.base_url

        self._installing = True
        self.async_write_ha_state()
        try:
            async with session.post(f"{base}/api/citofono/install", json={}, timeout=120) as resp:
                body = await resp.json(content_type=None)
                if resp.status != 200 or not body.get("ok"):
                    raise RuntimeError(
                        "Intercom install failed: " + str(body.get("error") or resp.status)
                    )

            # Il citofono sta per riavviarsi (comando di reboot gia' inviato
            # dall'add-on) — aspettiamo che ricompaia online CON la versione
            # nuova, invece di considerarci finiti subito dopo la risposta.
            elapsed = 0
            while elapsed < POST_INSTALL_TIMEOUT_S:
                await asyncio.sleep(POST_INSTALL_POLL_INTERVAL_S)
                elapsed += POST_INSTALL_POLL_INTERVAL_S
                try:
                    async with session.get(f"{base}/api/citofono/status", timeout=10) as resp:
                        if resp.status == 200:
                            status = await resp.json(content_type=None)
                            if status.get("online") and status.get("deployed") == target_version:
                                break
                except Exception:  # noqa: BLE001 — normale mentre il citofono e' giu', ritenta
                    pass
            else:
                _LOGGER.warning(
                    "Il citofono non ha confermato la versione %s entro %ss dopo il riavvio "
                    "(potrebbe comunque essere andato a buon fine, controlla lo stato manualmente)",
                    target_version, POST_INSTALL_TIMEOUT_S,
                )
        finally:
            self._installing = False
            await self.coordinator.async_request_refresh()
