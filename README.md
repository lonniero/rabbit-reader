# 🐇 Rabbit Reader

**RSVP Speed Reading for Rabbit R1**

A single-word-at-a-time speed reader designed as an R1 Creation, optimized for the Rabbit R1's 240×282 pixel display.

---

## Features

- **RSVP Engine** — Displays text one word at a time at your chosen speed
- **ORP Highlighting** — Highlights the Optimal Recognition Point in each word (orange pivot letter) for faster processing
- **Smart Pacing** — Automatically pauses longer on punctuation (periods, commas) and long words
- **Scroll Wheel Speed** — Use the R1's scroll wheel to adjust WPM (100–1000)
- **Tap to Play/Pause** — Touch the word zone to toggle playback
- **Built-in Library** — 4 pre-loaded texts to get started
- **Paste Mode** — Paste any text to read

## Controls

| Input | Action |
|-------|--------|
| **Scroll wheel** | Adjust WPM speed (±25) |
| **Tap word area** | Play / Pause |
| **◁ / ▷** | Step back / forward one word |
| **↺** | Restart from beginning |
| **✕** | Exit to menu |

## Deploy to R1

### 1. Host the files
Push to GitHub and enable **GitHub Pages**, or deploy to **Netlify**:

```bash
# GitHub Pages
git init
git add .
git commit -m "Rabbit Reader v1"
git remote add origin git@github.com:YOUR_USER/rabbit-reader.git
git push -u origin main
# Then enable Pages in repo Settings → Pages → Source: main / root
```

### 2. Generate QR Code
Use the [Rabbit QR Creator](https://github.com/rabbit-hmi-oss/creations-sdk/tree/main/qr) tool:
- **Name:** Rabbit Reader
- **Description:** RSVP Speed Reading
- **Link:** `https://YOUR_USER.github.io/rabbit-reader/`

### 3. Install on R1
On your Rabbit R1:
1. Open the **Creations** card
2. Tap **Add via QR Code**
3. Scan the generated QR code

## Tech Specs

- **Display:** 240×282px (R1 native)
- **Stack:** Single HTML file, inline CSS + JS
- **Dependencies:** None
- **Hosting:** Any static host
