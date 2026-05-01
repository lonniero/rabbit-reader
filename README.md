# 🐇 Rabbit Reader

**RSVP Speed Reading for Rabbit R1**

A single-word-at-a-time speed reader designed as an R1 Creation, optimized for the Rabbit R1's 240×282px display. Supports **PDF** and **EPUB** uploads.

---

## Features

| Feature | Description |
|---------|-------------|
| **RSVP Engine** | One word at a time with smart pacing |
| **ORP Highlighting** | Orange pivot letter for faster recognition |
| **PDF Upload** | Client-side parsing via pdf.js |
| **EPUB Upload** | Reads spine/chapter order via JSZip |
| **Resume Reading** | Saves position per book in localStorage |
| **Scroll Wheel Speed** | 100–1000 WPM in 25 WPM steps |
| **Built-in Library** | Sample texts + your uploaded books |

## Controls

| Input | Action |
|-------|--------|
| **Scroll wheel** | Adjust WPM (±25) |
| **Tap word area** | Play / Pause |
| **◁ / ▷** | Step word back / forward |
| **↺** | Restart |
| **✕** | Exit to menu |

## File Structure

```
rabbit-reader/
├── index.html    ← Entry point
├── style.css     ← R1-optimized styles (240×282)
├── app.js        ← RSVP engine + PDF/EPUB parsers
└── README.md
```

## Deploy to R1

### 1. Host on GitHub Pages

```bash
git remote add origin git@github.com:YOUR_USER/rabbit-reader.git
git push -u origin main
# Settings → Pages → Source: main / root
```

### 2. Generate QR Code

Use the [Rabbit QR Creator](https://github.com/rabbit-hmi-oss/creations-sdk/tree/main/qr):
- **Name:** Rabbit Reader
- **Description:** RSVP Speed Reading with PDF/EPUB
- **Link:** `https://YOUR_USER.github.io/rabbit-reader/`

### 3. Install on R1

1. Open **Creations** card on your R1
2. Tap **Add via QR Code**
3. Scan the generated QR code

## Dependencies (CDN)

- [pdf.js 3.11.174](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js) — PDF text extraction
- [JSZip 3.10.1](https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js) — EPUB container unpacking
