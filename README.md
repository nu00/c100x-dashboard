<p align="center"><img src="assets/icon-256.png" width="150" alt="C100X Dashboard"></p>

_Changelog: [c100x_dashboard/CHANGELOG.md](c100x_dashboard/CHANGELOG.md)_

# C100X Dashboard

> The integration ships its own icon in `custom_components/c100x_dashboard/brand/` (Home Assistant 2026.3+).

Design custom screens for a **BTicino Classe 100X** video intercom and push them to its
display from **Home Assistant** — with live sensor values. Compose screens by dragging
elements onto an 800×480 canvas in a web editor; the intercom shows the active screen and
refreshes the values every second.

> 🇮🇹 [Leggi in italiano](README.it.md)

![Editor screenshot](docs/screenshot.png)

> **About this project — authorship.** Roughly **99% of this project was written by Claude**
> (Anthropic's AI), working from the goals, testing, and on-device feedback provided by the
> repository owner. The owner directed the design, ran everything against real hardware, and
> validated each step; the code, the QML, the add-on and the integration were produced by Claude.

## What's in here

- **Add-on** (`c100x_dashboard/`) — a Home Assistant add-on that is both the **editor** (web UI)
  and the **server** the intercom polls. It reads entity values from HA, renders Jinja2 templates,
  and serves the active screen, images and icons over HTTP.
- **Intercom side** (`c100x_dashboard/citofono/`) — `SchedaPage.qml`, the renderer that runs on
  the intercom, plus the patch scripts. Can be installed automatically from the add-on via SSH.
- **Integration** (`custom_components/c100x_dashboard/`) — an optional Home Assistant integration
  that adds services (`show`, `hide`, `set_active`) so you can trigger screens by name from
  automations.

## How it works

```
Editor (add-on) ──save──> screen layouts (JSON)
                                │
HA automation / Node-RED ─show─> add-on ──GET /active──> intercom (polls ~1s)
                                  │                          │
                                  └─ reads HA entity values ─┘ values refresh live
```

The intercom polls `http://<add-on>:8099/active` every second. When you "show" a screen, the
intercom wakes and displays it; values update on screen while it stays up. You can hide it on
command (handy for "show during a blackout, hide when power is back").

## Requirements

- A BTicino **Classe 100X** with SSH access and the community controller
  ([fquinto/bticinoClasse300x](https://github.com/fquinto/bticinoClasse300x) / [slyoldfox/c300x-controller](https://github.com/slyoldfox/c300x-controller)).
- **Home Assistant** with the Supervisor (Home Assistant OS or Supervised), needed to run add-ons.
- The intercom and HA on the same LAN; the intercom must be able to reach HA over **HTTP**.
- Node.js present on the intercom (it ships with the controller setup) for the QML patch step.

## Install the add-on

**As a local add-on (simplest):**

1. Copy the `c100x_dashboard/` folder into your Home Assistant `/addons/` directory
   (via the *Samba*, *SSH & Web Terminal* or *Studio Code Server* add-ons).
2. Settings → Add-ons → Store → ⋮ → **Check for updates**. It appears under *Local add-ons*.
3. Open it → **Install** (the first build also downloads the MDI icon set), then **Start**.
4. The editor shows up in the HA sidebar (Ingress). It's also at `http://IP_HA:8099/`.

**As an add-on repository (one click for others):** push this repo to GitHub, then in HA add the
repo URL under Store → ⋮ → *Repositories*. The add-on installs from there.

> To ship changes, bump `version:` in `config.yaml`: Home Assistant then offers an **Update** for the add-on (Settings → Add-ons → Store → ⋮ → **Check for updates**). The add-on's ⋮ → **Rebuild** is only needed to force a fresh build without a version change.

## Use the editor

**Elements** — add from the palette: text, sensor value, entity icon, template, image, icon,
shapes, line, arrow.

- **Sensor value**: search the entity (autocomplete) and get a live preview. Optionally show a
  specific **attribute** instead of the state, append the **unit of measurement automatically**,
  and **format dates/times** (e.g. `DD/MM/YYYY`, `HH:mm`).
- **Entity icon**: icon and colour follow the entity state. You can **force a specific icon**
  while keeping the state-driven colour, or drive the colour from a **conditional template**.
- **Template**: write Jinja2 with basic markdown (bold, italic, headings, lists, line breaks),
  rendered like a Lovelace markdown card. A second template can set the colour conditionally
  (a direct colour, or true/false → two configurable colours).

**Intercom buttons** — click a key on the on-screen intercom to bind a Home Assistant action to
it. The front keys (1–4, ★, lock, eye), the wheel (up/down/OK) and both handsets are supported.
Each button can show an on-screen message (which may contain Jinja2 for dynamic text) and
optionally light up on press. Action data may also contain Jinja2 templates.

**Editing** — drag to move, bottom-right handle to resize, top handle to rotate. Extras:

- Arrow keys move by 1px (Shift = 10px), PgUp/PgDn change stacking order, Del removes.
- Select several elements (Shift-click or rubber-band) to align them; **group** with Ctrl+G,
  ungroup with Ctrl+Shift+G.
- Zoom with the wheel, pan with the middle mouse button, double middle-click to reset.

**Screens** — name the layout and **Save**; press **Show now** (with a duration) to display it
on the intercom. From the home screen you can **export** all screens to a backup file and
**import** them back — handy so you don't lose your work if you reinstall the add-on.

## Install on the intercom

Press **Intercom** in the editor, enter the intercom's SSH host/user/password and the
**add-on URL as the intercom sees it** (e.g. `http://192.168.1.10:8099`), then
**Install / update**. The add-on uploads `SchedaPage.qml`, patches `main.qml` (with a backup)
and reboots. A checkbox lets you store the SSH password in the add-on or be asked each time.

Prefer manual install? See `c100x_dashboard/citofono/README.md`.

## Install the integration (optional)

The integration is **separate from the add-on** and is **not installed automatically** — the
add-on can't write into HA's `custom_components/`. You only need it if you want the convenient
`show` / `hide` / `set_active` services in your automations; without it you can still drive the
add-on over REST (see below).

1. Copy `custom_components/c100x_dashboard/` into your HA `config/custom_components/`
   (or add this repo to HACS as a custom *integration*).
2. Restart Home Assistant.
3. Settings → Devices & Services → **Add integration → C100X Dashboard**, and enter the add-on URL
   (e.g. `http://192.168.1.10:8099`).

## Trigger screens from Home Assistant

**With the integration.** Once installed (see above), you get these actions:

```yaml
# Show a named screen, keep it until hidden
action: c100x_dashboard.show
data:
  name: consumi
  duration: 0

# Hide whatever is on screen
action: c100x_dashboard.hide

# Just set the active screen (without showing)
action: c100x_dashboard.set_active
data:
  name: consumi
```

**Without the integration (REST).** The add-on is a small REST server, so two calls work from
Node-RED (`http request` nodes) or HA `rest_command`:

```yaml
rest_command:
  citofono_mostra:
    url: "http://192.168.1.10:8099/api/show"
    method: POST
    content_type: "application/json"
    payload: '{"name":"{{ name }}","duration":{{ duration | default(0) }}}'
  citofono_nascondi:
    url: "http://192.168.1.10:8099/api/hide"
    method: POST
```

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | editor (Ingress) |
| GET/PUT/DELETE | `/api/layouts[/:name]` | list / save / delete layouts |
| GET | `/api/layout-live/:name` | layout with values resolved to the current state (thumbnails) |
| GET/POST | `/api/export` · `/api/import` | back up / restore all screens |
| POST | `/api/template-preview` | render a Jinja2 template for the editor preview |
| POST | `/api/active` | set the active layout |
| POST | `/api/show` | show now (`{name?, duration?}`) |
| POST | `/api/hide` | hide |
| GET | `/api/entities` · `/api/icons` · `/api/entity-icons` | autocomplete sources |
| GET | `/icon/:name` · `/image/:name` · `/ha-image/:name` | icons / images for editor + intercom |
| POST | `/api/citofono/install` | upload + patch + reboot via SSH |
| GET | `/active` | for the intercom: active layout with resolved values |

## Notes & limits

- Port 8099 is exposed on the LAN without auth (the intercom must reach it). Fine on a home LAN.
- The intercom's display has a limited colour gamut: flat graphics, icons and shapes look great;
  photographic images may shift in colour.
- Only MDI icons are supported (HA's built-in set); custom icon packs aren't served to the intercom.
- Template elements support **basic** markdown (bold, italic, headings, lists, line breaks): the
  intercom renders an HTML subset (Qt 5 RichText), so very complex markdown may not render exactly.
- The SSH password, if saved, is stored in the add-on's `/data` in clear text and never returned
  to the browser.

## Credits

This project stands on the shoulders of prior reverse-engineering work by the BTicino intercom community:

- [slyoldfox/c300x-controller](https://github.com/slyoldfox/c300x-controller) — the on-device controller this project relies on (Node runtime, HTTP endpoints, Home Assistant bridge).
- [slyoldfox/c300x-dashboard](https://github.com/slyoldfox/c300x-dashboard) — the inspiration: a controller-fed QML dashboard for the C300X (Qt 4.8.7 / QtQuick 1.x). Since it states *"Bticino c100x devices are untested"* and targets a different Qt/QtQuick generation, the renderer here was written from scratch for the C100X (Qt5 / QtQuick 2.x).
- [fquinto/bticinoClasse300x](https://github.com/fquinto/bticinoClasse300x) — the modified firmware that makes root/SSH access possible.
- [Roboto](https://fonts.google.com/specimen/Roboto) (Apache License 2.0) — the bundled UI font, shared by the editor and the intercom renderer.

## License

MIT — see `LICENSE`.
