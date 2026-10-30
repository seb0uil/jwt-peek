# JWT Peek

A Chrome extension (Manifest V3) that decodes a JWT as soon as you highlight it on a page. Everything runs locally: no network calls, no storage, no dependencies.

## Features

- **Decode on selection**: highlight a JWT with the mouse or keyboard (Shift + arrows, Ctrl/Cmd+A) and a card appears below the selection.
- **Forgiving selection**:
  - the token can be buried in surrounding text (`Authorization: Bearer eyJ…`, a full JSON body, a log line…);
  - whitespace and line breaks inside the token are ignored;
  - a double-click that only grabs one segment (`.` and `-` break words) is expanded to the full token, and the visible selection is updated to match;
  - works inside `<input>` and `<textarea>` too.
- **Status**: a `non expiré` (valid) / `expiré` (expired) / `pas encore valide` (not yet valid) / `sans exp` (no exp) badge, computed from `exp` and `nbf`.
- **Readable dates** for `exp`, `nbf`, `iat`, `auth_time` and `updated_at`: local date (fr-FR) plus a relative delay ("dans 12 min", "il y a 3.2 h"), along with the token lifetime (`ttl = exp − iat`). Millisecond timestamps are detected automatically.
- **Header and payload** pretty-printed as JSON, with `alg` and `kid` shown in the title bar.
- **Copy payload**: copies the formatted payload to the clipboard.
- Dismiss with `Esc`, a click outside, scrolling, or resizing the window.

> ⚠️ The signature is **not verified**. JWT Peek is for reading a token, not validating it.

The UI is in French.

## Installation

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

Also works in other Chromium-based browsers (Edge, Brave, Arc…).

## Structure

```
manifest.json       MV3 manifest: injects the scripts below, in order, into every page and iframe
src/jwt.js          Jwt — base64url/JSON decoding and JWT search in text (no DOM)
src/format.js       Fmt — time claims, relative dates, TTL, expiration status
src/selection.js    TokenSelection — reads the selected token from the focused field or the page
src/card.js         Card — renders the decoded token in a closed Shadow DOM, copy button, positioning
src/main.js         Entry point: event listeners
```

MV3 content scripts can't be ES modules, but scripts listed in the same `content_scripts` entry share one scope and load in order. Each file therefore exposes a single namespace object (`Jwt`, `Fmt`, `TokenSelection`, `Card`), which keeps helpers private and avoids shadowing globals such as `window.close` or `window.status`. A file can only use namespaces from files listed before it in `manifest.json`.

### How it works

| Part | Role |
|---|---|
| `Jwt.parse`, `Jwt.findIn`, `Jwt.findAround` | Decodes the header and payload (base64url → UTF-8 → JSON) and finds a JWT in a text or around a cursor position (regex `eyJ….….…`; each candidate is validated with `parse`) |
| `TokenSelection.get` | Reads the current selection: focused input field first, then the page selection, then expands a partial selection |
| `Fmt` | Expiration status and date/duration formatting |
| `Card.show` / `Card.close` | Builds the card inside a closed Shadow DOM and positions it below (or above) the selection |
| `main.js` | `mouseup` / `keyup` trigger detection; `mousedown`, `scroll`, `resize` and `Esc` close the card. Listeners use the capture phase so they still fire on pages that stop propagation |

## Security and privacy

- No `fetch`, no `chrome.storage`, no API permissions declared.
- Token content is treated as untrusted: it is only ever rendered with `textContent`, never `innerHTML`.
- The card lives in a `closed` Shadow DOM with `all: initial`, isolating it from the page's styles.
- Tokens longer than 20,000 characters and selections longer than 100,000 characters are ignored.

Note: because the content script is injected on `<all_urls>`, Chrome shows the "Read and change all your data on all websites" warning at install time. That is the cost of detecting tokens on any page.

## Known limitations

- A token split across several DOM nodes (syntax highlighting, one `<span>` per segment) is only detected if the selection covers all of it.
- Input fields inside a page's own Shadow DOM are not read (`document.activeElement` returns the shadow host).
- Only JWS is supported (3 segments, header starting with `eyJ`). JWE tokens are not decrypted.
- Dates are shown in `fr-FR` format only.
