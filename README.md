# Folder Highlighter

An [Obsidian](https://obsidian.md) plugin that highlights folder and file names in the file explorer with an **inline background colour** — only the text label is highlighted, not the full row.

![Obsidian](https://img.shields.io/badge/Obsidian-1.0%2B-7c3aed?logo=obsidian&logoColor=white)
![License](https://img.shields.io/github/license/philipppollmann/obsidian-folder-highlighter)
![Release](https://img.shields.io/github/v/release/philipppollmann/obsidian-folder-highlighter)

---

## Features

- **Inline text highlight** — background colour wraps only the name, not the whole row
- **Background & text colour** — set both independently per folder or file
- **Hex and RGB input** — enter colours as `#rrggbb`, `#rgb`, or `rgb(r, g, b)`
- **Native colour picker** — synced with the text input, both update each other live
- **Bold / Italic** — optional typography overrides
- **Presets** — save named colour combinations and reuse them with one click
- **Presets as code** — edit all presets as raw JSON in the settings tab (version-control friendly)

---

## Usage

### Highlight a folder or file

1. Right-click any folder or file in the file explorer
2. Choose **Highlight appearance**
3. Set background colour, text colour, bold/italic as desired
4. Click **Apply**

### Use a preset

In the modal, pick an existing preset from the dropdown to load it instantly.
To save the current style as a preset, type a name and click **Save preset**.

### Manage presets as code

Open **Settings → Folder Highlighter**.
The *Presets (as code)* textarea shows all presets as JSON — edit directly, paste from another vault, or commit to version control.

```json
[
  {
    "name": "Important",
    "style": {
      "backgroundColor": "#ff4444",
      "textColor": "#ffffff",
      "isBold": true,
      "isItalic": false
    }
  },
  {
    "name": "Project",
    "style": {
      "backgroundColor": "#ffff00",
      "textColor": "",
      "isBold": false,
      "isItalic": false
    }
  }
]
```

---

## Installation

### From Obsidian (community plugins)

> Not yet listed. Install manually for now.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/philipppollmann/obsidian-folder-highlighter/releases/latest)
2. Copy them into `.obsidian/plugins/obsidian-folder-highlighter/` inside your vault
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

### BRAT

Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) and add:
```
philipppollmann/obsidian-folder-highlighter
```

---

## Development

```bash
# Install dependencies
npm install

# Watch mode (dev build with source maps)
npm run dev

# Production build
npm run build
```

The built `main.js` goes into the repo root. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder to test.

---

## Release

Releases are automated via GitHub Actions. To publish a new version:

1. Bump `"version"` in `manifest.json` and `package.json`
2. Commit: `git commit -am "chore: release vX.Y.Z"`
3. Tag and push:
   ```bash
   git tag X.Y.Z
   git push origin main --tags
   ```

The workflow builds the plugin and creates a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached automatically.

---

## License

[MIT](LICENSE)
