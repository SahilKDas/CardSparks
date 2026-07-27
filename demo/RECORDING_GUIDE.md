# Sidekick AI — 2:58 Recording Guide

## Preflight

1. Add the free Gemini and Ticketmaster keys to `.env` if available.
2. Run `npm run test:all` and `npm run build`.
3. Start with `npm start` and open `http://localhost:8000`.
4. Under Business Profile, click **Reset recorded-demo story** if an old session is present; otherwise start from the onboarding screen. The reset must show no pre-built Launch Kit.
5. Set browser zoom to 90–100%, close unrelated tabs, hide bookmarks, silence notifications, and use a 1440×900 or larger capture.
6. Record one normal take and one take with `SIDEKICK_OFFLINE=1`.

## Script and cursor path

### 0:00–0:18 — The problem

Show the onboarding screen without moving the cursor.

> “Small business owners already have signals—sales, the weather, and what’s happening nearby. What they don’t have is a data team connecting those signals into a clear next move.”

### 0:18–0:36 — Meet the sidekick

Click **See the coffee shop demo**.

> “Sidekick is a morning co-pilot, not another dashboard. This is Juniper Coffee, a neighborhood shop trying to grow weekday traffic.”

### 0:36–0:58 — Show honest learning

Pause on **Yesterday’s win**, click **See the learning loop**, then open **Campaign Debrief** on the measured action.

> “Sidekick remembers that a rainy-morning offer finished $210 above Juniper’s comparable-day baseline—but it does not pretend correlation proves causation. This Learning Receipt traces the signals, recommendation, result, and owner note. Because that earlier play had zero direct code redemptions, Sidekick explicitly learns to add better attribution next time.”

### 0:58–1:20 — Show counsel and evidence

Close the Debrief, return to **Morning briefing**, and open **How I connected the dots** on the first event recommendation.

> “Today it combines that lesson with the live forecast, recent sales, and nearby activity. Every recommendation shows the exact evidence, confidence, and result worth measuring.”

### 1:20–1:36 — Turn advice into action

Close the evidence strip. Click **Put this in my plan**, then open **Today’s Playbook**.

> “Advice only matters when it becomes action. One click turns the recommendation into a small, measurable play.”

### 1:36–2:16 — Launch Kit wow moment

Click **Build Launch Kit**. Point first to `FESTIVALFUEL` in the trackable-code card and customer copy, then the sidewalk sign, operations checklist, suggested time, baseline, and calendar task. Click **Edit kit**, change the first task owner to a teammate’s first name, and click **Save & approve**. Do not click Print during the primary take.

> “Now Sidekick does more than advise. It creates Festival Fuel: customer-ready copy, a branded sign, staff checklist, timing, calendar task, and baseline. Its FESTIVALFUEL code gives Juniper a direct response count without a POS integration. The owner can edit every artifact and explicitly approve the final version—AI proposes, the owner decides.”

Close the Studio. Let the **Owner approved** badge remain visible for one beat.

### 2:16–2:34 — Close the learning loop

Show the seeded measured result. If recording a longer interaction, add another recommendation, mark it done, and open **Log the result** without submitting invented numbers.

> “After the day, the owner records sales, campaign-code redemptions, and a note. Sidekick compares the result with similar weekdays, preserves the attribution warning, and brings the measured pattern into tomorrow’s advice.”

### 2:34–2:48 — Technical credibility

Return to Morning Briefing and scroll to the three signal cards.

> “Open-Meteo and Ticketmaster supply live signals when available. Claude, Gemini, and the local engine share validated schemas, while SQLite preserves owner edits, approvals, redemptions, and learning.”

### 2:48–2:58 — Close

Return to the measured-win card.

> “Sidekick gives a neighborhood owner the daily counsel and learning loop that chains get from a data team. It turns local signals into action—and every action makes tomorrow’s advice smarter.”

## Editing notes

- Use hard cuts; avoid animated transitions or background music that competes with narration.
- Add only three captions: **Connect the signals**, **Build the play**, **Learn what worked**.
- Keep the source/provider badges visible long enough to read.
- Never call curated events live or imply that seeded sales are real.
- End on the product, not an architecture slide.

## Backup take

```powershell
$env:SIDEKICK_OFFLINE='1'
npm start
```

The narrative stays the same. Say “resilient fallback forecast” instead of “live forecast,” and keep the offline/source labels in frame. The local generator must reveal the complete Festival Fuel kit immediately; no network spinner should appear.
