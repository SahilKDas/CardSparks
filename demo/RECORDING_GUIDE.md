# Sidekick AI — 2:50 Recording Guide

## Preflight

1. Add the free Gemini and Ticketmaster keys to `.env` if available.
2. Run `npm run test:all` and `npm run build`.
3. Start with `npm start` and open `http://localhost:8000`.
4. Under Business Profile, click **Reset recorded-demo story** if an old session is present; otherwise start from the onboarding screen.
5. Set browser zoom to 90–100%, close unrelated tabs, hide bookmarks, silence notifications, and use a 1440×900 or larger capture.
6. Record one normal take and one take with `SIDEKICK_OFFLINE=1`.

## Script and cursor path

### 0:00–0:20 — The problem

Show the onboarding screen without moving the cursor.

> “Small business owners already have signals—sales, the weather, and what’s happening nearby. What they don’t have is a data team connecting those signals into a clear next move.”

### 0:20–0:38 — Meet the sidekick

Click **See the coffee shop demo**.

> “Sidekick is a morning co-pilot, not another dashboard. This is Juniper Coffee, a neighborhood shop trying to grow weekday traffic.”

### 0:38–1:12 — Show counsel and evidence

Pause on **Yesterday’s win**, then open **How I connected the dots** on the first recommendation.

> “Sidekick remembers that a rainy-morning offer finished $210 above Juniper’s normal comparable-day baseline. Today it combines that learning with the live forecast, recent sales, and nearby activity. Every recommendation shows the exact evidence, confidence, and result worth measuring.”

### 1:12–1:36 — Turn advice into action

Close the evidence strip. Click **Put this in my plan**, then open **Today’s Playbook**.

> “Advice only matters when it becomes action. One click turns the recommendation into a small, measurable play.”

### 1:36–2:03 — Close the learning loop

Show the seeded measured result. If recording a longer interaction, add another recommendation, mark it done, and open **Log the result** without submitting invented numbers.

> “After the day, the owner records sales and whether the play helped. Sidekick compares that result with similar weekdays, saves the outcome, and brings what worked into tomorrow’s briefing.”

### 2:03–2:30 — Technical credibility

Return to Morning Briefing and scroll to the three signal cards.

> “The weather and geocoding come from Open-Meteo. Nearby events come from Ticketmaster when configured, with public-holiday and clearly labeled demo fallbacks. The advisor uses Claude, then Gemini’s free tier, then a deterministic local engine. SQLite preserves the full learning history.”

### 2:30–2:50 — Close

Return to the measured-win card.

> “Sidekick gives a neighborhood owner the daily counsel and learning loop that chains get from a data team. It turns local signals into action—and every action makes tomorrow’s advice smarter.”

## Editing notes

- Use hard cuts; avoid animated transitions or background music that competes with narration.
- Add only three captions: **Connect the signals**, **Act on one move**, **Learn what worked**.
- Keep the source/provider badges visible long enough to read.
- Never call curated events live or imply that seeded sales are real.
- End on the product, not an architecture slide.

## Backup take

```powershell
$env:SIDEKICK_OFFLINE='1'
npm start
```

The narrative stays the same. Say “resilient fallback forecast” instead of “live forecast,” and keep the offline/source labels in frame.
