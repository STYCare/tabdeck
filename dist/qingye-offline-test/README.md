# Tab Deck

Tab Deck is a calm Chrome new-tab extension that turns your open tabs into a lightweight dashboard.

It groups tabs by site so you can quickly scan what is already open, clean up duplicates, save tabs for later, and jump back into context without tab chaos.

## Features

- Replace the default new tab page with a grouped tab dashboard
- Group open tabs by domain
- One-tap duplicate cleanup inside each group
- Save tabs to **Read Later**
- Reopen or remove saved tabs
- Search open tabs or type a URL directly
- Editable Quick Links
- Lightweight in-page confirmation modal for destructive actions
- Chinese and English UI copy

## Browser support

Currently tested for Chromium-based browsers that support:

- Manifest V3 extensions
- `chrome_url_overrides.newtab`
- loading unpacked extensions in developer mode

Recommended:

- Chrome
- Edge

Other Chromium browsers may work, but compatibility can vary depending on extension policy and new-tab override support.

## Local install

### Chrome / Edge

1. Open the browser extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in this repository

## Project structure

```text
qingye/
  README.md
  extension/
    manifest.json
    background.js
    index.html
    app.js
    style.css
    icons/
  dist/
```

## Privacy

Tab Deck does not require login, does not connect to a backend, and does not upload tab data.

The extension only uses:

- `chrome.storage.local`
- current browser tab information

## Release artifacts

Generated test packages are placed in `dist/`:

- `tabdeck-extension-only.zip` — extension files only
- `qingye-offline-test.zip` — README + extension folder for sharing with testers

## Status

Current version: `0.1.0`

This repository is currently prepared for GitHub publishing and manual tester distribution.
