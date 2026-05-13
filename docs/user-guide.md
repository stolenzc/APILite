# Postlite User Guide

Postlite is a lightweight desktop HTTP client built with Tauri (Rust) and React. It provides a Postman-like interface for making, testing, and managing API requests.

## Table of Contents

- [Getting Started](#getting-started)
- [Interface Overview](#interface-overview)
- [Making Requests](#making-requests)
- [Query Parameters](#query-parameters)
- [Request Headers](#request-headers)
- [Request Body](#request-body)
- [Response Panel](#response-panel)
- [cURL Import & Export](#curl-import--export)
- [Request History](#request-history)
- [Settings](#settings)
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

```
postlite/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs          # Tauri entry point & command registration
│   │   ├── curl_parser.rs   # cURL command parsing
│   │   ├── curl_export.rs   # cURL command generation
│   │   ├── http_client.rs   # HTTP request engine
│   │   └── history.rs       # In-memory history cache
│   ├── Cargo.toml
│   └── tauri.conf.json
├── frontend/            # React + TypeScript frontend
│   └── src/
│       ├── App.tsx
│       ├── components/      # UI components
│       ├── store/           # Zustand state management
│       ├── i18n.ts          # Internationalization
│       ├── themes.ts        # Theme definitions
│       └── constants.ts     # Header suggestions
└── docs/                # Documentation
```

---

## Interface Overview

The Postlite interface consists of three main areas:

1. **Header Bar** — Contains the application name and a settings button (⚙).
2. **URL Bar** — HTTP method selector, URL input, cURL import/export buttons, and the Send button.
3. **Request Editor** — Tabbed panel with Params, Headers, and Body tabs.
4. **Response Panel** — Shows the response status code, duration, body, and headers.
5. **History Panel** — Lists recent requests for quick re-use.

---

## Making Requests

### Sending a Request

1. Select an HTTP method from the dropdown (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS).
2. Enter the request URL in the URL input field.
3. Optionally configure parameters, headers, or body using the tabs below.
4. Click **Send** or press `Ctrl+Enter`.

### URL Input

The URL field accepts:
- A standard HTTP/HTTPS URL (e.g., `https://httpbin.org/get`)
- A URL with query parameters (e.g., `https://httpbin.org/get?foo=bar&baz=qux`)
- A cURL command (detected when pasting text starting with `curl`)

---

## Query Parameters

### Automatic Detection

When you type a URL with a query string (e.g., `?key1=val1&key2=val2`), Postlite automatically parses and populates the **Params** table.

### Manual Editing

Switch to the **Params** tab to:
- **Add** a parameter by clicking "+ Add Parameter"
- **Edit** a parameter by typing in the key/value cells
- **Remove** a parameter by clicking the × button
- **Enable/Disable** a parameter using the checkbox

Changes in the Params table are synced back to the URL bar in real time.

---

## Request Headers

Switch to the **Headers** tab to configure request headers.

### Autocomplete

When typing in the key field, Postlite shows suggestions from a built-in list of common HTTP headers:

| Header | Description |
|--------|-------------|
| `Accept` | Media type the client can understand |
| `Content-Type` | Media type of the request body |
| `Authorization` | Authentication credentials (Bearer token) |
| `User-Agent` | Client software identification |
| `Cookie` | Stored HTTP cookies |
| `Origin` | Origin of the request (CORS) |
| `X-Api-Key` | API key for authentication |

Navigate suggestions with arrow keys and press Enter to select.

---

## Request Body

Switch to the **Body** tab to configure the request body. Supported formats:

| Format | Content-Type | Description |
|--------|-------------|-------------|
| **None** | — | No request body |
| **Raw** | — | Raw text, no content-type set |
| **JSON** | `application/json` | JSON-formatted data |
| **XML** | `application/xml` | XML-formatted data |
| **Text** | `text/plain` | Plain text |
| **HTML** | `text/html` | HTML content |
| **Form Data** | `multipart/form-data` | File upload / form fields |
| **x-www-form-urlencoded** | `application/x-www-form-urlencoded` | URL-encoded key-value pairs |

Each format type provides an appropriate placeholder template to get started.

---

## Response Panel

After sending a request, the response panel displays:

- **Status Code** — Color-coded badge (green for 2xx, yellow for 3xx, red for 4xx/5xx)
- **Duration** — Response time in milliseconds
- **Body Tab** — Response content with automatic JSON formatting
- **Headers Tab** — Response headers in a key-value table

---

## cURL Import & Export

### Import cURL

1. Click the **`{}`** button next to the URL bar.
2. Paste a complete cURL command in the dialog.
3. Click **Import**.

Postlite parses the command and fills in:
- HTTP method (`-X`)
- URL
- Headers (`-H`)
- Request body (`-d`, `--data`, `--data-raw`, `--data-binary`, `--data-urlencode`)

### Export cURL

1. Configure your request (method, URL, params, headers, body).
2. Click the **`→_`** button next to the URL bar.
3. View and copy the generated cURL command.

The export automatically includes:
- Method (`-X`) for non-GET requests
- URL with all parameters
- Headers (`-H`)
- Request body (`-d`)
- Auto-generated `Content-Type` header for JSON/XML body types

---

## Request History

The history panel at the bottom of the window records your most recent requests:

- **Time** — When the request was sent
- **Method** — Color-coded HTTP method badge
- **URL** — Full request URL
- **Status** — Response status code

Click any history entry to reload that request's configuration into the editor. The history is stored in memory and cleared when the app closes.

---

## Settings

Open settings by clicking the ⚙ icon or pressing `Ctrl+,`.

### Language

Choose between **English** and **中文 (Chinese)**. The interface text updates immediately.

### Theme

Select from five built-in themes:

| Theme | Description |
|-------|-------------|
| **Dark** | Default dark theme with deep blue tones |
| **Light** | Clean white and light gray theme |
| **Nord** | Arctic-inspired cool blue palette |
| **Solarized Dark** | Classic solarized dark color scheme |
| **Monokai** | Editor-inspired dark theme with vibrant accents |

### Keyboard Shortcuts

Configure custom keyboard shortcuts for common actions. Click "Reset Shortcuts" to restore defaults, or "Reset All" to clear all settings.

---

## Keyboard Shortcuts

| Action | Default Shortcut |
|--------|-----------------|
| Send Request | `Ctrl+Enter` |
| Focus URL Bar | `Ctrl+L` |
| Open Settings | `Ctrl+,` |
| Import cURL | `Ctrl+Shift+I` (configured) |
| Export cURL | `Ctrl+Shift+E` (configured) |
| Save Request | `Ctrl+S` (configured) |

All shortcuts can be customized in Settings.
