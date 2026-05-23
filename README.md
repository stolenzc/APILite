<p align="center">
  <img src=".github/assets/logo.png" width="128" height="128" alt="APILite">
</p>

<h1 align="center">APILite</h1>

<p align="center">
  A lightweight desktop HTTP client built with Tauri (Rust) and React <br>It provides a Postman-like interface for making, testing, and managing API requests.
</p>

<p align="center">
  <a href="README.zh.md">简体中文</a>
</p>

<p align="center">
  <picture>
    <img alt="APILite HTTP client with request editor and response panel" src=".github/assets/app.png" width="800">
  </picture>
</p>

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Getting Started](#getting-started)
  - [Building from Source](#building-from-source)
  - [Project Structure](#project-structure)
- [Interface Overview](#interface-overview)
- [Environments](#environments)
- [Saving Requests to Folders](#saving-requests-to-folders)
- [Making Requests](#making-requests)
  - [Sending a Request](#sending-a-request)
  - [URL Input](#url-input)
- [Query Parameters](#query-parameters)
  - [Automatic Detection](#automatic-detection)
  - [Manual Editing](#manual-editing)
- [Request Headers](#request-headers)
  - [Autocomplete](#autocomplete)
- [Request Body](#request-body)
- [Response Panel](#response-panel)
- [cURL Import \& Export](#curl-import--export)
  - [Import cURL](#import-curl)
  - [Export cURL](#export-curl)
- [Request History](#request-history)
- [Settings](#settings)
  - [Language](#language)
  - [Theme](#theme)
  - [Local Storage](#local-storage)
  - [History Retention](#history-retention)
  - [Resizable Splitters](#resizable-splitters)
  - [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Getting Started

### Building from Source

```bash
# Install dependencies
npm install

# Start development mode
npm run tauri dev
```

### Project Structure

```plain text
APILite/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs          # Tauri entry point & command registration
│   │   ├── curl_parser.rs   # cURL command parsing
│   │   ├── curl_export.rs   # cURL command generation
│   │   ├── http_client.rs   # HTTP request engine
│   │   ├── histories.rs     # History persistence (daily JSON shards)
│   │   ├── storage.rs       # Data directory layout
│   │   ├── environments.rs  # Environment variables on disk
│   │   └── folders.rs       # Saved request tree on disk
│   ├── Cargo.toml
│   └── tauri.conf.json
├── frontend/            # React + TypeScript frontend
│   └── src/
│       ├── App.tsx
│       ├── components/      # UI (TitleBar, tabs, panels, modals, …)
│       ├── store/           # Zustand state management
│       ├── i18n.ts          # Internationalization
│       ├── themes.ts        # Theme definitions
│       └── constants.ts     # Header suggestions
```

---

## Interface Overview

| Area                    | Description                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title bar**        | Panel toggles: folders (left), history (bottom), cURL (right), and settings (⚙). On macOS the bar sits in the overlay title-bar region. |
| **Tab bar**          | Request tabs, **+** for a new tab, environment dropdown and manage (⚙).                                                                     |
| **Folders sidebar**  | Optional left panel — tree of folders and saved requests.                                                                                   |
| **URL bar**             | HTTP method, URL, **Send**.                                                                                                                 |
| **Request editor**      | **Params**, **Headers**, **Body** tabs.                                                                                                     |
| **Response panel**      | Status, duration, body / headers / raw HTTP. A loading overlay appears while a request is in flight.                                        |
| **cURL panel**          | Optional right panel — live cURL for the current request with **Copy**.                                                                     |
| **History panel**       | Optional bottom dock — persisted history; drag the top edge to resize.                                                                      |

Thin drag handles (same style as the history dock) resize the response area, folders sidebar, cURL panel, and history height.

---

## Environments

Pick an environment from the dropdown on the **tab bar**. Use `{{variable_name}}` in the URL, params, headers, or body; values are resolved when you send. Click **⚙** beside the dropdown to edit variables (multiple environments, `{{other_var}}` references within the same environment).

---

## Saving Requests to Folders

1. Configure the request, then press **⌘ S** / **Ctrl+S** (or save from the folders sidebar when applicable).
2. Enter a **request name**.
3. In the folder browser, expand folders with **▶** / **▾**, click a folder to select it, then **Save** (or double-click a folder to save immediately).
4. Use the toolbar button above the tree: **New folder** when nothing is selected, **New subfolder** when a folder is selected (click blank area in the tree to deselect).

---

## Making Requests

### Sending a Request

1. Select an HTTP method from the dropdown (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS).
2. Enter the request URL in the URL input field.
3. Optionally configure parameters, headers, or body using the tabs below.
4. Click **Send** or press **⌘ Enter** (macOS) / **Ctrl+Enter** (Windows & Linux).

### URL Input

The URL field accepts:

- A standard HTTP/HTTPS URL (e.g., `https://httpbin.org/get`)
- A URL with query parameters (e.g., `https://httpbin.org/get?foo=bar&baz=qux`)
- A cURL command (detected when pasting text starting with `curl`)

---

## Query Parameters

### Automatic Detection

When you type a URL with a query string (e.g., `?key1=val1&key2=val2`), APILite automatically parses and populates the **Params** table.

### Manual Editing

Switch to the **Params** tab to:

- **Add** a parameter by typing in the last empty key/value row (a new empty row appears automatically)
- **Edit** a parameter by typing in the key/value cells
- **Remove** a parameter by clicking the × button
- **Enable/Disable** a parameter using the checkbox

Changes in the Params table are synced back to the URL bar in real time.

---

## Request Headers

Switch to the **Headers** tab to configure request headers.

### Autocomplete

When typing in the key field, APILite shows suggestions from a built-in list of common HTTP headers:

| Header          | Description                               |
| --------------- | ----------------------------------------- |
| `Accept`        | Media type the client can understand      |
| `Content-Type`  | Media type of the request body            |
| `Authorization` | Authentication credentials (Bearer token) |
| `User-Agent`    | Client software identification            |
| `Cookie`        | Stored HTTP cookies                       |
| `Origin`        | Origin of the request (CORS)              |
| `X-Api-Key`     | API key for authentication                |

Navigate suggestions with arrow keys and press Enter to select.

---

## Request Body

Switch to the **Body** tab to configure the request body. Supported formats:

| Format                    | Content-Type                        | Description                          |
| ------------------------- | ----------------------------------- | ------------------------------------ |
| **None**                  | —                                   | No request body                      |
| **Raw**                   | —                                   | Raw text, no content-type set        |
| **JSON**                  | `application/json`                  | JSON-formatted data                  |
| **XML**                   | `application/xml`                   | XML-formatted data                   |
| **Text**                  | `text/plain`                        | Plain text                           |
| **HTML**                  | `text/html`                         | HTML content                         |
| **Form Data**             | `multipart/form-data`               | Key/value table; text or file fields |
| **x-www-form-urlencoded** | `application/x-www-form-urlencoded` | Key/value table, URL-encoded         |
| **Binary**                | `application/octet-stream`          | Single file as raw body              |

For **Form Data** and **x-www-form-urlencoded**, use the key/value table in the Body tab (enable rows with the checkbox). File fields open a file picker (desktop) or browser file input. **Raw** subtypes (JSON, XML, etc.) include placeholder templates where helpful.

---

## Response Panel

After sending a request, the response panel displays:

- **Status Code** — Color-coded badge (green for 2xx, yellow for 3xx, red for 4xx/5xx)
- **Duration** — Response time in milliseconds
- **Body Tab** — Response content with automatic JSON formatting
- **Headers Tab** — Response headers in a key-value table
- **Raw Tab** — Full raw HTTP response

While a request is running, a semi-transparent overlay with a spinner covers the response area (previous content stays visible underneath).

---

## cURL Import & Export

### Import cURL

Paste a complete `curl …` command into the **URL** field (or paste with the URL field focused). APILite detects `curl` and parses:

- HTTP method (`-X`)
- URL
- Headers (`-H`)
- Request body (`-d`, `--data`, `--data-raw`, `--data-binary`, `--data-urlencode`)

Press **Enter** in the URL field after pasting if the command was not applied automatically.

### Export cURL

1. Open the **cURL** panel from the title bar (right panel icon).
2. Edit the request — the command updates automatically.
3. Click **Copy** in the panel.

Generated cURL includes method (`-X`) when needed, full URL, headers (`-H`), body (`-d`, `--data-binary`, or `-F` for file fields), and `Content-Type` for JSON/XML when missing.

---

## Request History

Toggle the bottom history dock from the title bar or **Ctrl+`**. The panel records sent requests:

- **Time** — When the request was sent
- **Method** — Color-coded HTTP method badge
- **URL** — Full request URL
- **Status** — Response status code

Expand a row to view the raw request and response. Click **Load more** to fetch older entries (50 per page). History is persisted under your data directory as daily files (`histories/YYYY-MM-DD.json`); retention limits are configurable in **Settings**.

---

## Settings

Open settings from the title bar **⚙** or **⌘ ,** (macOS) / **Ctrl+,** (Windows & Linux).

### Language

Choose between **English** and **中文 (Chinese)**. The interface text updates immediately.

### Theme

Select from five built-in themes:

| Theme              | Description                                     |
| ------------------ | ----------------------------------------------- |
| **Dark**           | Default dark theme with deep blue tones         |
| **Light**          | Clean white and light gray theme                |
| **Nord**           | Arctic-inspired cool blue palette               |
| **Solarized Dark** | Classic solarized dark color scheme             |
| **Monokai**        | Editor-inspired dark theme with vibrant accents |

### Local Storage

Choose a folder for app data (default `~/.APILite`). The app creates:

- `folders/` — saved requests (folder tree)
- `histories/` — request history (one JSON file per day)
- `environments.json` — environment variables

### History Retention

Set maximum age (days) and maximum entry count. Older or excess entries are pruned from disk automatically.

### Resizable Splitters

Drag the thin bar between the request editor and response panel to resize the response area (min 100px; height is saved). Similar handles resize the folders sidebar, cURL panel, and history dock.

### Keyboard Shortcuts

Configure shortcuts in **Settings**. **Reset Shortcuts** restores defaults; **Reset All** clears all settings.

Most defaults use **⌘** on macOS and **Ctrl** on Windows/Linux. **Toggle History** always uses physical **Ctrl+`** (not Command on Mac). Menu bar items (**APILite** / **Tab**) mirror some actions in the Tauri build and only apply while the app is focused.

| Action                     | macOS   | Windows / Linux      |
| -------------------------- | ------- | -------------------- |
| Send Request               | ⌘ Enter | Ctrl+Enter           |
| Save Request               | ⌘ S     | Ctrl+S               |
| Toggle Folders Sidebar     | ⌘ B     | Ctrl+B               |
| Toggle History Panel       | Ctrl+`  | Ctrl+`               |
| Toggle cURL Panel          | ⌘ ⌥ B   | Ctrl+Alt+B           |
| Focus URL Bar              | ⌘ L     | Ctrl+L               |
| Focus Folder Search        | ⌘ ⇧ F   | Ctrl+Shift+F         |
| Open Settings              | ⌘ ,     | Ctrl+,               |
| New Tab                    | ⌘ T     | Ctrl+T               |
| Close Tab                  | ⌘ W     | Ctrl+W               |
| Previous Tab               | ⌘ ⌥ ←   | Ctrl+Alt+Left Arrow  |
| Next Tab                   | ⌘ ⌥ →   | Ctrl+Alt+Right Arrow |

All shortcuts can be customized in **Settings**.
