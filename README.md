# Sidekick AI

**New here?** Read [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) for the three-minute product, demo, status, and finish-plan overview. Teammates and coding agents should then read [`CONTEXT.md`](CONTEXT.md) for architecture, contracts, guardrails, and tradeoffs.

Sidekick AI is a real-time business co-pilot for independent owners. It connects recent sales, weather, and nearby events, recommends three concrete moves, turns one into a ready-to-use **Launch Kit**, measures the result against a comparable-day baseline, and brings that learning into tomorrow’s advice.

> Sidekick gives a neighborhood owner the daily counsel and learning loop that chains get from a data team.

The ready-made story follows **Juniper Coffee Co.**, a Portland coffee shop trying to grow weekday traffic. Demo sales, events, and the seeded historical outcome are always labeled; live sources identify themselves separately.

## What the app demonstrates

- Two-step onboarding with CSV upload or manual sales entry.
- Responsive morning briefing with seven-day weather, source-labeled events, and sales trends.
- Anthropic → Gemini free tier → deterministic local advisor fallback chain.
- Validated recommendation schema with confidence, success metric, and exact evidence.
- Expandable “How I connected the dots” sales × weather × events trail.
- **Today’s Playbook** with planned, completed, dismissed, and measured actions.
- One-click **Launch Kit Studio** with social/SMS copy, a printable sidewalk sign, operations checklist, suggested timing, calendar download, and measurement plan.
- Memorable campaign codes embedded in every customer-facing artifact, with redemption counts captured alongside observed sales.
- Owner editing for customer copy, sign text, timing, campaign code, and operations, followed by an explicit **Owner approved** version.
- Idempotent Launch Kits: reopen the stored kit or explicitly regenerate it without changing the action’s planned status.
- Outcome logging and lift calculation against historical sales for the same weekday.
- A **Campaign Debrief / Learning Receipt** tracing Signals → Recommendation → Launch Kit → Result → Lesson with deliberately non-causal language.
- A visible “Yesterday’s win” and recommendations informed by measured outcomes.
- Resettable, idempotent recorded-demo story.
- Optional, deterministic **two-minute judge tour** that highlights the measured win, evidence, Playbook, Launch Kit, and owner approval while advancing from real application events.
- SQLite history and 15-minute event caching.
- Explicit offline recording mode that never waits for external services.

## Run it

Requirements: [Node.js 20+](https://nodejs.org/) and [Python 3.11+](https://www.python.org/downloads/). The backend has no third-party Python dependencies.

```powershell
cd C:\SahilAppProjects\Sidekick_AI\Sidekick_AI
npm install
npm start
```

Open [http://localhost:8000](http://localhost:8000), then choose **See the coffee shop demo** for free exploration or **Start the two-minute judge tour** for the guided presentation path.

The demo reset creates one clearly labeled prior action that earned **$210 above its comparable-day baseline**. It then generates a fresh briefing that learns from that result, but deliberately does not pre-build a Launch Kit. Put the first event recommendation into the Playbook and click **Build Launch Kit** to reveal the “Festival Fuel” demo beat. The judge tour performs this reset automatically; it never starts for a non-demo business and can be exited with Escape. Reset the unguided story any time under **Business profile → Reset recorded-demo story**.

## Zero-cost API setup

The app works without any keys. For the strongest recorded demo, copy the environment template:

```powershell
Copy-Item .env.example .env
notepad .env
```

### Gemini free tier

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Do **not** enable billing.
3. Add `GEMINI_API_KEY=...` to `.env`.

The free tier may use submitted content to improve Google products. Sidekick sends compact business context and aggregated sales signals; use fictional/demo data for judging unless you accept Google’s free-tier data terms.

### Anthropic

If the Anthropic Console grants free trial credits, add `ANTHROPIC_API_KEY=...`. Do not add paid billing solely for this demo. With `AI_PROVIDER=auto`, Sidekick tries Anthropic first, Gemini second, and its local advisor last.

### Ticketmaster

Create a free key through the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) and add `TICKETMASTER_API_KEY=...`. The default quota is ample for a hackathon. Without it, Sidekick tries live public holidays and then clearly labeled curated demo events.

Recommended `.env`:

```dotenv
AI_PROVIDER=auto
SIDEKICK_OFFLINE=0
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GEMINI_API_KEY=your-free-google-ai-studio-key
GEMINI_MODEL=gemini-3.6-flash
TICKETMASTER_API_KEY=your-free-ticketmaster-key
```

Never commit `.env`; it is ignored by git.

## Live data and honest fallbacks

| Signal | Preferred source | Key | Fallback |
|---|---|---:|---|
| Location | Open-Meteo Geocoding | No | Entered city label |
| Weather | Open-Meteo Forecast | No | Labeled demo forecast |
| Events | Ticketmaster Discovery | Optional/free | Nager.Date holidays, then labeled curated events |
| AI | Anthropic Messages API | Optional credits | Gemini free tier, then explainable local advisor |
| History and learning | SQLite | No | Local file at `backend/sidekick.db` |

Event responses are cached for 15 minutes. Source and freshness appear in the UI.

## Fully offline rehearsal

Use this for the backup recording or venue Wi-Fi failure:

```powershell
$env:SIDEKICK_OFFLINE='1'
npm start
```

Offline mode immediately uses labeled demo weather/events and the local advisor; it does not attempt external API requests. To return to normal mode:

```powershell
Remove-Item Env:SIDEKICK_OFFLINE
```

## Use your own sales data

CSV files require `date,amount` columns:

```csv
date,amount
2026-07-24,1680
2026-07-25,1940
2026-07-26,1525
```

Dates use `YYYY-MM-DD`. A sample is available at [`demo/sample_sales.csv`](demo/sample_sales.csv).

## Recorded submission

Use [`demo/RECORDING_GUIDE.md`](demo/RECORDING_GUIDE.md) for the exact 2:58 storyboard, guided and manual cursor paths, Launch Kit reveal, Campaign Debrief, preflight checklist, and offline backup take.

Because no real business owner is available for testing, use [`demo/USABILITY_TEST.md`](demo/USABILITY_TEST.md) with five non-technical participants. Report completion rates and timing honestly; do not invent a testimonial.

## Development and tests

Development uses two terminals:

```powershell
# Terminal 1
python -m backend.app

# Terminal 2
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to port 8000.

Run every automated test and create a production build:

```powershell
npm run test:all
npm run build
```

## API

```text
POST  /api/briefing
GET   /api/history?business=...
POST  /api/actions
GET   /api/actions?business=...
PATCH /api/actions/{id}
POST  /api/actions/{id}/outcome
POST  /api/actions/{id}/launch-kit
GET   /api/actions/{id}/launch-kit
PATCH /api/actions/{id}/launch-kit
POST  /api/demo/reset
GET   /api/health
```

`POST /api/actions/{id}/outcome` accepts observed sales, `yes`/`no`/`unsure`, and an optional note. The backend determines the comparable weekday from the stored sales history and returns baseline, lift amount, and lift percentage.

The outcome request also accepts an optional non-negative integer `redemptions`. This records how many customers mentioned the Launch Kit’s campaign code; it does not claim the campaign caused the measured sales change.

`POST /api/actions/{id}/launch-kit` returns the stored kit when one exists. Send `{"refresh": true}` to replace it. Generation uses the same Anthropic → Gemini → local provider chain and one normalized schema; the provider receives only aggregated business/action context, not raw customer data. Actions returned by the API include `has_launch_kit` and optional `launch_kit`.

`PATCH /api/actions/{id}/launch-kit` persists owner edits and accepts `owner_approved`. The backend revalidates the schedule and checklist and ensures the sanitized campaign code remains present in the social copy, SMS, and sign.

## Architecture

```text
React + Recharts responsive UI
            │ JSON
Python threaded HTTP API (zero pip dependencies)
   ├── AI provider adapter + shared schema validation
   ├── Open-Meteo weather and geocoding
   ├── Ticketmaster / Nager.Date / labeled fallback + cache
   └── SQLite profiles, briefings, actions, outcomes, and campaign kits
```

The deliberately small stack keeps the recorded demo dependable while still demonstrating real APIs, structured AI, persistence, useful campaign artifacts, explainability, graceful degradation, and a measurable learning loop.

The deployment owner should use [`demo/DEPLOYMENT_HANDOFF.md`](demo/DEPLOYMENT_HANDOFF.md) for the minimal writable-volume and smoke-test checklist. This workstream intentionally does not add hosting infrastructure.
