# Tab Deck

Are your tabs so squashed they look like a barcode? Is your laptop fan sounding like a jet engine about to take off? Stop the madness.

**Tab Deck** turns tab chaos into a calm, lightweight dashboard. It groups your open tabs by site, helps you clean up duplicates, lets you save things for later, and gives your poor RAM a fighting chance.

## What it does

- Replaces the default new tab page with a grouped tab dashboard
- Groups your open tabs by domain
- Lets you clean duplicate tabs in one tap
- Saves tabs to **Read Later**
- Reopens or removes saved tabs
- Searches open tabs or opens a URL directly
- Supports editable Quick Links
- Uses a lightweight in-page modal for destructive actions
- Switches between Chinese and English UI copy based on browser language

## Why it exists

Because twenty tiny tabs are not a workflow. They are a cry for help.

Tab Deck is built for people who keep a lot open, forget what is already open, open the same thing three times, and then wonder why the machine sounds mildly offended.

## Browser support

Currently tested on Chromium-based browsers that support:

- Manifest V3 extensions
- `chrome_url_overrides.newtab`
- loading unpacked extensions in developer mode

Recommended:

- Chrome
- Edge

Other Chromium browsers may work too, but browser policies around new-tab overrides can be annoyingly inconsistent.

## Install locally

### Chrome / Edge

1. Open the browser extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in this repository

## Project structure

```text
tabdeck/
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

It only uses:

- `chrome.storage.local`
- current browser tab information

## Acknowledgements

Tab Deck was inspired by **tab-out** by **Zara Zhang**, and built and iterated with **OpenClaw**.

## Release artifacts

Generated test packages are placed in `dist/`:

- `tabdeck-extension-only.zip` — extension files only
- `tabdeck-offline-test.zip` — README + extension folder for sharing with testers

## Current status

Current version: `0.1.0`

This repository is currently set up for GitHub publishing and manual tester distribution.
