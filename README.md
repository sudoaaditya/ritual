# Rituals

A PWA for tracking skin care, hair care and diet plans. It runs entirely in the browser: there's no server and no account, and it works offline. It installs on iPhone and Android.

- **Welcome**: pick Skin, Hair and/or Diet and get ready-made plans in one tap.
- **Today**: a week strip with progress rings (swipe it to change week) and a "Next" card. **Swipe a row right to complete it, left to skip.** Every Done or Skip shows an **Undo** toast. Items whose time has passed get an **Overdue** group, and a streak count shows next to the date. Confetti appears when you finish the day.
- **Guided routine**: tap **▶ Start** on Morning or Night to go through the steps one at a time, full screen, with optional **step timers** (e.g. 60 s cleanse, 10 min mask). It keeps the screen awake and beeps when a timer ends.
- **Daily check-in**: a one-tap 😣→😄 rating for each plan, tags (Irritation, Shedding, Bloated…), a note and a progress photo.
- **Plans**: a weekly items×days grid, an 18-week heatmap, **progress photos with a before/after slider**, items and milestones.
- **Insights**: streaks, perfect days, completion trend, per-plan and per-item adherence, plus **"How you've felt"**: ratings over time, most common tags and simple patterns (for example "Irritation was logged on 60% of days after Retinoid vs 10% otherwise").
- **Settings**: theme (system/dark/light), backup export and restore (includes photos and check-ins), delete all data.

All data stays on the device in IndexedDB. Use **Export backup** before switching phones.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve the build on :4173
```

## Deploy to Vercel

Import the repo in Vercel. `vercel.json` already sets the build command, the output folder (`dist`), the SPA rewrites and the cache headers. Any other static host (Netlify, Cloudflare Pages, GitHub Pages) works too.

## Install on phones

- **iPhone**: open the URL in Safari, tap Share, then **Add to Home Screen**.
- **Android (Chrome)**: tap **Install app** (or ⋮ then Add to Home screen).

## Structure

```
src/sw.ts            service worker (offline cache only)
src/lib/             schedule rules, db (Dexie), actions, progress maths, templates, icons, badge
src/screens/         Today, Calendar, Plans, Insights, Settings
src/components/      ItemRow, sheets (item/plan/milestone editors, detail, search), UI bits
```
