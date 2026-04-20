# Tab Deck

> Are your tabs so squashed they look like a barcode? Is your laptop fan sounding like a jet engine about to take off? Stop the madness. Use this extension to turn that tab chaos into a zen dashboard. Save your RAM, and your sanity!

Tab Deck turns tab chaos into a calm, lightweight dashboard. It groups your open tabs by site, helps you clean up duplicates, lets you save things for later, and gives your poor RAM a fighting chance.

No server, no npm, no build step. Just load the extension and go.

---

## 🚀 What it does

- **Calm Dashboard** — Replaces the default new tab page with a cleaner view of your open tabs.
- **Domain Grouping** — Automatically groups tabs by site for faster scanning and navigation.
- **One-Tap Cleanup** — Spot and close duplicate tabs in one tap.
- **Read Later** — Save interesting tabs for later without keeping them open.
- **Quick Search** — Search open tabs or jump straight to a URL from the keyboard.
- **Quick Links** — Keep your most-used tools one click away.
- **Bilingual Support** — Automatically switches between English and Chinese based on browser language.
- **Lightweight Interactions** — Keeps actions fast without jarring system popups.

## 🧠 Why it exists

Because twenty tiny tabs are not a workflow. They are a cry for help.

Tab Deck is built for people who keep too much open, forget what is already there, open the same thing three times, and then wonder why their machine sounds mildly offended.

## 💻 Browser Support

Currently tested on:

- Chrome

Other Chromium-based browsers may also work, but they are not officially tested yet.

## 🛠️ Manual Setup

### 1. Clone the repo

```bash
git clone https://github.com/STYCare/tabdeck.git
cd tabdeck
```

### 2. Load the Chrome extension

Open Chrome and go to:

```text
chrome://extensions
```

Then:

- Enable **Developer mode** (top-right toggle)
- Click **Load unpacked**
- Navigate to the `extension/` folder inside the cloned repo
- Select that `extension/` folder

### 3. Open a new tab

Open a new tab in Chrome.

You should see **Tab Deck** replace the default new tab page.

## ⚡ Quick Start

Once installed, Tab Deck helps you:

- scan all open tabs by domain
- jump back to an already-open page
- close duplicate tabs quickly
- save tabs to **Read Later**

## 📦 Release Artifact

- `dist/tabdeck-extension.zip`

## 📂 Project Structure

```text
tabdeck/
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── index.html
│   ├── app.js
│   └── style.css
├── dist/
└── README.md
```

## 🔒 Privacy

Tab Deck does not require login, does not connect to a backend, and does not upload tab data.

It only uses:

- `chrome.storage.local`
- current browser tab information

## 📄 License

MIT

## 🙏 Acknowledgements

Tab Deck was inspired by **tab-out** by **Zara Zhang**, and built and iterated with **OpenClaw**.
